"use client"

import { ContractReceipt, ethers } from "ethers";
import React, { Suspense, useContext, useEffect, useRef, useState } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import { Tab } from '@headlessui/react'
import { Canvas } from '@react-three/fiber';
import DescriptionIcon from '@mui/icons-material/Description';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import CachedIcon from '@mui/icons-material/Cached';
import useDownloader from "react-use-downloader";
import { useConnectWallet } from "@web3-onboard/react";
import QRCode from "react-qr-code";
import Image from "next/image";

import Cartridge from "../models/cartridge";
import {SciFiPedestal} from "../models/scifi_pedestal";
import Loader from "../components/Loader";
import { VerificationOutput, getOutputs, VerifyPayload as VerifyPayloadInput, registerExternalVerification } from '../backend-libs/core/lib';
import { VerifyPayload } from '../backend-libs/core/ifaces';
import CartridgeDescription from './CartridgeDescription';
import Link from 'next/link';
import CartridgeScoreboard from './CartridgeScoreboard';
import CartridgeTapes from './CartridgeTapes';
import { envClient } from "../utils/clientEnv";
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from "@mui/icons-material/Close";
import { sha256 } from "js-sha256";
// @ts-ignore
import GIFEncoder from "gif-encoder-2";
import { insertTapeGif } from "../utils/util";

enum STATUS {
    WAITING,
    SUBMIT,
    SUBMITING,
    FINISHED
}

interface LOG_STATUS {
    status:STATUS,
    error?:string
}

function logFeedback(logStatus:LOG_STATUS, setLogStatus:Function) {
    if (logStatus.error) {
        // delay(5000).then(() =>{
        //     setLogStatus({status: logStatus.status});
        // })

        return (
            <div className="fixed text-[10px] flex-col items-center max-w-xs p-4 bg-gray-400 shadow right-5 bottom-5 z-40" role="alert">
                <div className="flex items-end p-1 border-b text-red-500">
                    <ErrorIcon/>
                    <div className="ms-2 text-sm font-normal">Error</div>
                </div>
                <div className="p-1 break-words">
                    {logStatus.error}
                </div>
            </div>
        )
    }
}


function generateGif(frames: string[],width:number,height:number): Promise<string> {

    const encoder = new GIFEncoder(width,height,'octree');
    encoder.setDelay(200);
    encoder.start();
    
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    let idx = 0;
    const addFrames = new Array<Promise<void>>();
    
    for (const frame of frames) {
        
        const p: Promise<void> = new Promise(resolveLoad => {
            const img = document.createElement("img");
            img.width = width;
            img.height = height;
            img.onload = () => {
                ctx?.drawImage(img,0,0,img.width,img.height);
                encoder.addFrame(ctx);
                resolveLoad();
            };
            img.src = frame;
        })
        addFrames.push(p);
        idx++;
    }
    return Promise.all(addFrames).then(() => {
        encoder
        encoder.finish();
        const buffer = encoder.out.getData();
        if (buffer) {
            var binary = '';
            var len = buffer.byteLength;
            for (var i = 0; i < len; i++) {
                binary += String.fromCharCode( buffer[ i ] );
            }
            return window.btoa( binary );
        }
        return "";
    });
    
}

function CartridgeInfo() {
    const {selectedCartridge, playCartridge, setGameplay, setReplay} = useContext(selectedCartridgeContext);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [{ wallet }, connect] = useConnectWallet();
    const { download } = useDownloader();
    const [submitLogStatus, setSubmitLogStatus] = useState({status: STATUS.WAITING} as LOG_STATUS);
    const [reloadScoreboardCount, setReloadScoreboardCount] = useState(0);

    const [tapeUrl, setTapeUrl] = useState("/tapes/0");
    // useEffect(() => {
    //     // auto reload scoreboard only if
    //     // gameplay log sent is valid and the selected cartridge is the same of the gameplay sent
    //     if (submitLogStatus.status === STATUS.VALID && submitLogStatus.cartridgeId === selectedCartridge?.id) {
    //         setReloadScoreboardCount(reloadScoreboardCount+1);
    //     }
    // }, [submitLogStatus])
    const [gifImage, setGifImage] = useState<string>("");
    
    useEffect(() => {
        if (selectedCartridge?.lastFrames && selectedCartridge?.width && selectedCartridge?.height) {
            if (selectedCartridge?.lastFrames) {
                generateGif(selectedCartridge.lastFrames,selectedCartridge.width,selectedCartridge.height).then((gif) => {
                    setGifImage(gif);
                })
                
            }
        }
    }, [selectedCartridge?.outhash,selectedCartridge?.width,selectedCartridge?.height,selectedCartridge?.lastFrames])
    
    useEffect(() => {
        if (selectedCartridge?.gameplayLog) submitLog();
    }, [selectedCartridge?.gameplayLog])

    if (!selectedCartridge) return <></>;

    var decoder = new TextDecoder("utf-8");

    async function submitLog() {
        // replay({car});
        if (!selectedCartridge || !selectedCartridge.gameplayLog){
            alert("No gameplay data.");
            return;
        }
        if (!selectedCartridge.outcard || !selectedCartridge.outhash ){
            alert("No gameplay output yet, you should run it.");
            return;
        }
        if (!wallet) {
            alert("Connect first to upload a gameplay log.");
            await connect();
        }

        setSubmitLogStatus({status: STATUS.SUBMIT});
        //setShowSubmitModal(true);
    }

    async function verifyLog() {
        // replay({car});
        if (!selectedCartridge || !selectedCartridge.gameplayLog){
            return;
        }
        if (!selectedCartridge.outcard || !selectedCartridge.outhash ){
            return;
        }
        if (!wallet) {
            return;
        }

        const signer = new ethers.providers.Web3Provider(wallet.provider, 'any').getSigner();
        console.log("Sending Replay:")
        if (decoder.decode(selectedCartridge.outcard.slice(0,4)) == 'JSON') {
            console.log("Replay Outcard",JSON.parse(decoder.decode(selectedCartridge.outcard).substring(4)))
        } else {
            console.log("Replay Outcard",selectedCartridge.outcard)
        }
        console.log("Replay Outcard hash",selectedCartridge.outhash)


        // setSubmitLogStatus({status: STATUS.SUBMIT});
        try {
            setSubmitLogStatus({status: STATUS.SUBMITING});
            let receipt: ContractReceipt;
            const inputData: VerifyPayload = {
                rule_id: '0x' + selectedCartridge.rule,
                outcard_hash: '0x' + selectedCartridge.outhash,
                tape: ethers.utils.hexlify(selectedCartridge.gameplayLog),
                claimed_score: selectedCartridge.score || 0
            }
            receipt = await registerExternalVerification(signer, envClient.DAPP_ADDR, inputData, {sync:false, cartesiNodeUrl: envClient.CARTESI_NODE_URL}) as ContractReceipt;

            if (receipt == undefined || receipt.events == undefined)
                throw new Error("Couldn't send transaction");

            const gameplay_id = getTapeId(selectedCartridge.gameplayLog);
            
            await insertTapeGif(gameplay_id, gifImage);

            setTapeUrl(`/tapes/${gameplay_id}`);
            // setShowNftLinkModal(true);
            setSubmitLogStatus({status: STATUS.FINISHED});

        } catch (error) {
            setSubmitLogStatus({...submitLogStatus, error: (error as Error).message});
        }
    }

    function getTapeId(log: Uint8Array): string {
        return sha256(log);
    }

    async function uploadLog() {
        // replay({car});
        fileRef.current?.click();
    }

    async function downloadLog() {
        // replay({car});
        const filename = "gameplay.rivlog";
        const blobFile = new Blob([selectedCartridge?.gameplayLog!], {
            type: "application/octet-stream",
        });
        const file = new File([blobFile], filename);
        const urlObj = URL.createObjectURL(file);
        download(urlObj, filename);
    }

    function handleOnChange(e: any) {
        const reader = new FileReader();
        reader.onload = async (readerEvent) => {
            const data = readerEvent.target?.result;
            if (data) {
                setGameplay(new Uint8Array(data as ArrayBuffer), undefined, undefined, undefined, undefined, undefined, undefined);
                e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(e.target.files[0])
    }

    async function prepareReplay(output: VerificationOutput) {
        if (selectedCartridge) {

            const replayLogs:Array<VerifyPayloadInput> = await getOutputs(
                {
                    tags: ["tape",output.tape_hash.slice(2)],
                    type: 'input'
                },
                {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
            );
            if (replayLogs.length > 0) {

                const tapePayload:VerifyPayloadInput = replayLogs[0];
                prepareTape(tapePayload);
            }
        }
    }

    function prepareTape(tapePayload: VerifyPayloadInput) {
        if (ethers.utils.isHexString(tapePayload.tape) && ethers.utils.isHexString(tapePayload.rule_id))
            setReplay(tapePayload.rule_id.slice(2), ethers.utils.arrayify(tapePayload.tape), tapePayload._msgSender);

    }


    function submissionHandler() {

        if (submitLogStatus.status === STATUS.WAITING) return <></>;

        let modalBody;
        switch (submitLogStatus.status) {
            case STATUS.SUBMIT:
                modalBody = <SubmitModal cancelFunction={setSubmitLogStatus} acceptFunction={verifyLog} gifImage={gifImage} />;
                break;
            case STATUS.SUBMITING:
                if (submitLogStatus.error) {
                    setSubmitLogStatus({status: STATUS.SUBMIT}); // goes back to the submission form
                } else {
                    modalBody = <div className="p-6 flex justify-center"><div className='w-12 h-12 border-2 rounded-full border-current border-r-transparent animate-spin'></div></div>;
                }

                break;
            case STATUS.FINISHED:
                modalBody = <FinishedSubmissionModal url={tapeUrl} gifImage={gifImage} />;
                break;
        }

        return (

            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-30 outline-none focus:outline-none"
            >
                <div className="relative w-max my-6 mx-auto">
                    {/*content*/}
                    <div className="border-0 shadow-lg relative flex flex-col w-full bg-gray-500 outline-none focus:outline-none p-4">
                        {/*header*/}
                        <div className='relative p-2 text-center mb-6'>
                            {/* <span>Submiting Gameplay</span> */}
                            <button className="absolute top-0 end-0 p-1 border border-gray-500 hover:border-black"
                            onClick={() => setSubmitLogStatus({status: STATUS.WAITING})}
                            >
                                <CloseIcon/>
                            </button>
                        </div>
                        <div className="flex space-x-8 justify-center items-end">
                            <div className={`flex flex-col items-center p-2 ${submitLogStatus.status < STATUS.FINISHED? "bg-black text-white":""}`}>
                                <span className="text-lg">1</span>
                                <span>Submit</span>
                            </div>
                            <div className={`flex flex-col items-center p-2 ${submitLogStatus.status > STATUS.SUBMITING? "bg-black text-white":""}`}>
                                <span className="text-lg">2</span>
                                <span>Share</span>
                            </div>

                        </div>
                        {/*body*/}
                        { modalBody }
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-wrap justify-center h-full w-full">
            <div className="w-64 h-96">
                <Canvas shadows camera={ {near: 0.1, far: 1000, position: [0,0,0]} }>
                    <Suspense fallback={<Loader />}>
                        <ambientLight intensity={1} />
                        <pointLight position={[4, -5, -10]} intensity={20} />
                        <pointLight position={[-4, -5, -10]} intensity={20} />
                        <spotLight
                            position={[0, -5, -10]}
                            angle={Math.PI}
                            penumbra={1}
                            intensity={80}
                        />
                        <hemisphereLight
                            color='#b1e1ff'
                            groundColor='#000000'
                            intensity={1}
                        />

                        <Cartridge
                        rotation={[0, -Math.PI/2, 0]}
                            key={selectedCartridge.cover}
                            position={[0,0,-10]}
                            cover={selectedCartridge.cover? `data:image/png;base64,${selectedCartridge.cover}`:"/logo.png"}
                            scale={[1, 1, 1]}
                        />
                        <SciFiPedestal position={[0, -5, -10]} scale={[0.3,0.3,0.3]}/>

                    </Suspense>
                </Canvas>
            </div>

            <div className="md:w-[512px] lg:w-[768px]">
                <div className="text-white mb-2">
                    <span className='text-4xl'>{selectedCartridge.name}</span>

                    {
                    !(selectedCartridge.info?.authors)?
                        <div className='h-6'></div>
                    :
                    (
                        <div className='flex space-x-2'>
                            <span>By</span>
                            <ul>
                                {selectedCartridge.info?.authors?.map((author, index) => (
                                    <li key={author.name}>
                                        <Link href={author.link}>
                                            {author.name}{index !== selectedCartridge.info!.authors!.length-1? ",": ""}
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                        </div>
                    )
                    }
                </div>

                <Tab.Group>
                    <Tab.List className="game-option-tabs-header">
                        <Tab
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span className='game-tabs-option-text'>
                                    <DescriptionIcon/>
                                    <span>Description</span>
                                </span>
                        </Tab>

                        <Tab
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span className='game-tabs-option-text'>
                                    <LeaderboardIcon/>
                                    <span>Leaderboard</span>
                                </span>
                        </Tab>

                        <Tab
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span className='game-tabs-option-text'>
                                    <OndemandVideoIcon/>
                                    <span>Tapes</span>
                                </span>
                        </Tab>
                        {/* <Tab
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span className='game-tabs-option-text'>
                                    <StadiumIcon/>
                                    <span>Tournaments</span>
                                </span>
                        </Tab>

                        <Tab
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span className='game-tabs-option-text'>
                                    <CodeIcon/>
                                    <span>Mods</span>
                                </span>
                        </Tab> */}
                    </Tab.List>

                    <Tab.Panels className="mt-2 overflow-auto custom-scrollbar">
                        <Tab.Panel className="game-tab-content ">
                            <CartridgeDescription/>
                        </Tab.Panel>

                        {/* lg: width is equal to the max-w-3xl */}
                        <Tab.Panel className="game-tab-content">
                            <div className="w-full flex">
                                <button title="Reload Scores (cached for 3 mins)" className="ms-auto scoreboard-btn" onClick={() => setReloadScoreboardCount(reloadScoreboardCount+1)}><span><CachedIcon/></span></button>
                            </div>
                            <CartridgeScoreboard cartridge_id={selectedCartridge.id} reload={reloadScoreboardCount} rule={selectedCartridge.rule} replay_function={prepareReplay}/>

                        </Tab.Panel>

                        <Tab.Panel className="game-tab-content">
                            <div className="w-full flex">
                                <button title="Reload Scores (cached for 3 mins)" className="ms-auto scoreboard-btn" onClick={() => setReloadScoreboardCount(reloadScoreboardCount+1)}><span><CachedIcon/></span></button>
                            </div>
                            <CartridgeTapes cartridge_id={selectedCartridge.id} reload={reloadScoreboardCount} rule={selectedCartridge.rule} replay_function={prepareTape}/>

                        </Tab.Panel>

                        {/* <Tab.Panel className="game-tab-content">
                            Coming Soon!
                        </Tab.Panel>

                        <Tab.Panel className="game-tab-content">
                            Coming Soon!
                        </Tab.Panel> */}
                    </Tab.Panels>
                </Tab.Group>

                {/* <div>
                    <CartridgeDescription/>
                </div> */}

                {
                    selectedCartridge.downloading?
                        <button className="btn w-full mt-2 flex justify-center">
                            <div className='w-5 h-5 border-2 rounded-full border-current border-r-transparent animate-spin'></div>
                        </button>
                    :
                        <button className="btn w-full mt-2" onClick={() => {playCartridge()}}>
                            PLAY
                        </button>

                }
            </div>

            {
                submissionHandler()
            }

            {
                submitLogStatus.status !== STATUS.WAITING?
                    <div className="opacity-25 fixed inset-0 z-20 bg-black"></div>
                :
                    <></>
            }

            {
                logFeedback(submitLogStatus, setSubmitLogStatus)
            }

        </div>
    );
}


function FinishedSubmissionModal({url,gifImage}:{url:String,gifImage:string}) {
    return (
        <div>
            {/*body*/}
            <div className="relative p-4 flex justify-center items-center">
                <div className={`relative my-6 px-6 flex-auto h-full`}>
                    <Image className="border border-black" width={200} height={200}  src={"data:image/gif;base64,"+gifImage} alt={"Rendering"}/>
                </div>
                <button className="place-self-center" title='Tape' onClick={() => window.open(`${url}`, "_blank", "noopener,noreferrer")}>
                    <div style={{ height: "auto", margin: "0 auto", maxWidth: 200, width: "100%" }} >
                        <QRCode
                        size={200}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        value={`${window.location.origin}${url}`}
                        viewBox={`0 0 200 200`}
                        />
                    </div>
                </button>
            </div>
        </div>
    );
}

function SubmitModal({cancelFunction,acceptFunction,gifImage}:{cancelFunction(s:{ status: STATUS }):void,acceptFunction():void,gifImage:string}) {
    
    return (
            <div>
                  {/*body*/}
                    <div className={`flex justify-center my-6 px-6 flex-auto h-full`}>
                        <Image className="border border-black" width={200} height={200}  src={"data:image/gif;base64,"+gifImage} alt={"Rendering"}/>
                    </div>
                    <div className="flex justify-end pb-2 pr-6">
                        <button
                        className={`bg-red-500 text-white font-bold uppercase text-sm px-6 py-2 border border-red-500 hover:text-red-500 hover:bg-transparent`}
                        type="button"
                        onClick={() => cancelFunction({status:STATUS.WAITING})}
                        >
                            Cancel
                        </button>
                        <button
                        className={`bg-emerald-500 text-white font-bold uppercase text-sm px-6 py-2 ml-1 border border-emerald-500 hover:text-emerald-500 hover:bg-transparent`}
                        type="button"
                        onClick={() => {acceptFunction()}}
                        >
                            Submit
                        </button>
                    </div>
            </div>
        );
  }
export default CartridgeInfo