"use client"

import { Parser } from "expr-eval";
import { ethers } from "ethers";
import Script from "next/script"
import { useContext, useState, useEffect } from "react";
import { useConnectWallet } from '@web3-onboard/react';

import CloseIcon from '@mui/icons-material/Close';
import RestartIcon from '@mui/icons-material/RestartAlt';
import StopIcon from '@mui/icons-material/Stop';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import { GIF_FRAME_FREQ, gameplayContext } from "../play/GameplayContextProvider";
import { sha256 } from "js-sha256";

function generateEntropy(userAddress?:String, ruleId?:String): string {

    const hexRuleId = `0x${ruleId}`;
    if (!userAddress || userAddress.length != 42 || !ethers.utils.isHexString(userAddress) || !ethers.utils.isHexString(hexRuleId)) {
        return "";
    }

    const userBytes = ethers.utils.arrayify(`${userAddress}`);
    const ruleIdBytes = ethers.utils.arrayify(hexRuleId);

    var fullEntropyBytes = new Uint8Array(userBytes.length + ruleIdBytes.length);
    fullEntropyBytes.set(userBytes);
    fullEntropyBytes.set(ruleIdBytes, userBytes.length);
    return sha256(fullEntropyBytes);
}

function RivemuPlayer(
        {cartridgeData, cartridge_id, rule_id, args, in_card, scoreFunction, userAddress, tape}:
        {cartridgeData:Uint8Array, cartridge_id: string, rule_id?:string, args?:string, in_card?:Uint8Array, 
            scoreFunction?:string, userAddress?:string, tape?:Uint8Array}) {
    const {setGameplayLog, setGifResolution, addGifFrame} = useContext(gameplayContext);

    const isTape = tape? true:false;

    // rivemu state
    const [runtimeInitialized, setRuntimeInitialized] = useState(false);
    const [currScore, setCurrScore] = useState<number>();
    const [playing, setPlaying] = useState({isPlaying: false, playCounter: 0})
    const [currProgress, setCurrProgress] = useState<number>();
    const [totalFrames, setTotalFrames] = useState<number>();
    const [lastFrameIndex, setLastFrameIndex] = useState<number>();

    // signer
    const [{ wallet }] = useConnectWallet();
    const [signerAddress, setSignerAddress] = useState<String|null>(wallet? wallet.accounts[0].address.toLowerCase(): null);

    useEffect(() => {
        if (!wallet) {
            setSignerAddress(null);
        }
        else {
            setSignerAddress(wallet.accounts[0].address.toLowerCase());
        }
    },[wallet]);


    if (isTape && (!userAddress || userAddress.length != 42)) {
        return (
            <span className="flex items-center justify-center h-lvh text-white">
                Missing user address from tape...
            </span>
        )
    }
    
    const parser = new Parser();
    const scoreFunctionEvaluator = scoreFunction? parser.parse(scoreFunction):null;
    
    // BEGIN: rivemu
    async function rivemuStart() {
        if (cartridgeData.length == 0) return;
        console.log("rivemuStart");

        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuInitialize();
        await rivemuHalt();
        setCurrScore(undefined);
        if (scoreFunction) {
            setCurrScore(0);
        }
        setLastFrameIndex(undefined);

        // @ts-ignore:next-line
        let cartridgeBuf = Module._malloc(cartridgeData.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(cartridgeData, cartridgeBuf);
        const inCard = new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        const params = args || "";
        // entropy
        let entropy = "";
        if (signerAddress) {
            entropy = generateEntropy(signerAddress,rule_id);
            if (entropy.length == 0) {
                alert("Invalid entropy");
                return;
            }
        }
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_record",
            null,
            ['number', 'number', 'number', 'number', 'string', 'string'],
            [
                cartridgeBuf,
                cartridgeData.length,
                incardBuf,
                inCard.length,
                entropy,
                params
            ]
        );
        // @ts-ignore:next-line
        Module._free(cartridgeBuf);
        // @ts-ignore:next-line
        Module._free(incardBuf);
    }


    async function rivemuReplay() {
        // TODO: fix rivemuReplay
        if (!cartridgeData || !tape) return;
        console.log("rivemuReplay");

        // // @ts-ignore:next-line
        // if (Module.quited) {
        //     // restart wasm when back to page
        //     // @ts-ignore:next-line
        //     Module._main();
        // }
        await rivemuInitialize();
        await rivemuHalt();
        setCurrScore(undefined);
        if (scoreFunction) {
            setCurrScore(0);
        }
        setCurrProgress(0);
        setLastFrameIndex(undefined);

        // @ts-ignore:next-line
        const cartridgeBuf = Module._malloc(cartridgeData.length);
        // @ts-ignore:next-line
        const rivlogBuf = Module._malloc(tape.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(cartridgeData, cartridgeBuf);
        // @ts-ignore:next-line
        Module.HEAPU8.set(tape, rivlogBuf);
        const inCard = in_card || new Uint8Array([]);
        // @ts-ignore:next-line
        let incardBuf = Module._malloc(inCard.length);
        // @ts-ignore:next-line
        Module.HEAPU8.set(inCard, incardBuf);
        const params = args || "";
        // entropy
        const entropy = generateEntropy(userAddress,rule_id);
        if (entropy.length == 0) {
            alert("Invalid entropy");
            return;
        }
        // @ts-ignore:next-line
        Module.ccall(
            "rivemu_start_replay",
            null,
            ['number', 'number', 'number', 'number', 'string', 'string', 'number', 'number'],
            [
                cartridgeBuf,
                cartridgeData.length,
                incardBuf,
                inCard.length,
                entropy,
                params,
                rivlogBuf,
                tape.length
            ]
        );
        // @ts-ignore:next-line
        Module._free(cartridgeBuf);
        // @ts-ignore:next-line
        Module._free(rivlogBuf);
        // @ts-ignore:next-line
        Module._free(incardBuf);
    }


    async function rivemuInitialize() {
        if (!runtimeInitialized) {
            // @ts-ignore:next-line
            if (typeof Module == "undefined" || typeof Module._rivemu_stop == "undefined")
                await waitEvent("rivemu_on_runtime_initialized");
            setRuntimeInitialized(true);
        }
    }

    async function rivemuHalt() {
        // @ts-ignore:next-line
        if (Module.ccall('rivemu_stop')) {
            await waitEvent('rivemu_on_shutdown');
        }
    }
    
    function waitEvent(name: string) {
        return new Promise((resolve) => {
            const listener = (e: any) => {
                window.removeEventListener(name, listener);
                resolve(e);
            }
            window.addEventListener(name, listener);
        })
    }

    async function rivemuStop() {
        console.log("rivemuStop");
        rivemuHalt();
    }

    function rivemuFullscreen() {
        const canvas: any = document.getElementById("canvas");
        if (canvas) {
            canvas.requestFullscreen();
        }
    }

    if (typeof window !== "undefined") {
        let decoder = new TextDecoder("utf-8");
        let parser = new Parser();
    
        // @ts-ignore:next-line
        window.rivemu_on_frame = function (
            outcard: ArrayBuffer,
            frame: number,
            cycles: number,
            fps: number,
            cpu_cost: number,
            cpu_speed: number,
            cpu_usage: number,
            cpu_quota: number
        ) {
            if (scoreFunctionEvaluator && decoder.decode(outcard.slice(0,4)) == 'JSON') {
                const outcard_str = decoder.decode(outcard);
                const outcard_json = JSON.parse(outcard_str.substring(4));
                setCurrScore(scoreFunctionEvaluator.evaluate(outcard_json));
            }
            if (isTape && totalFrames && totalFrames != 0){
                setCurrProgress(Math.round(100 * frame/totalFrames));
            } else if (lastFrameIndex == undefined || frame >= lastFrameIndex + fps/GIF_FRAME_FREQ) {
                const canvas = document.getElementById("canvas");
                if (!canvas) return;

                const frameImage = (canvas as HTMLCanvasElement).toDataURL('image/jpeg');
                addGifFrame(frameImage);
                setLastFrameIndex(frame);
            }
        };

        // @ts-ignore:next-line
        window.rivemu_on_begin = function (width: number, height: number, target_fps: number, total_frames: number) {
            console.log("rivemu_on_begin");
            if (isTape && total_frames) setTotalFrames(total_frames);
            else setGifResolution(width, height);
        };

        // @ts-ignore:next-line
        window.rivemu_on_finish = function (
            rivlog: ArrayBuffer,
            outcard: ArrayBuffer,
            outhash: string
        ) {
            rivemuStop();
            console.log("rivemu_on_finish")
            if (isTape && totalFrames && totalFrames != 0)
                setCurrProgress(100);
            if (!isTape && rule_id && signerAddress) {
                let score: number | undefined = undefined;
                if (scoreFunctionEvaluator && decoder.decode(outcard.slice(0,4)) == 'JSON') {
                    const outcard_str = decoder.decode(outcard);
                    const outcard_json = JSON.parse(outcard_str.substring(4));
                    score = scoreFunctionEvaluator.evaluate(outcard_json);
                }
                setGameplayLog(
                    {
                        cartridge_id,
                        log: new Uint8Array(rivlog),
                        outcard: {
                            value: new Uint8Array(outcard),
                            hash: outhash
                        },
                        score,
                        rule_id
                    }
                );
            }
            setPlaying({isPlaying: false, playCounter: playing.playCounter+1});
        };
    }
    // END: rivemu

    async function playTape() {
        await rivemuReplay();
        setPlaying({...playing, isPlaying: true});
    }

    async function playGame() {
        await rivemuStart();
        setPlaying({...playing, isPlaying: true});
    }

    return (
        <main className="flex items-center justify-center">
            <section className="grid grid-cols-1 gap-4 place-items-center">
                <div>
                <div className='relative bg-gray-500 p-2 text-center'>
                    <button className="bg-gray-700 text-white absolute top-1 start-2.5 border border-gray-700 hover:border-black"
                    onKeyDown={() => null} onKeyUp={() => null}
                    onClick={() => {isTape? playTape():playGame()}}>
                        <RestartIcon/>
                    </button>

                    { !rule_id ? <></> : currScore == undefined ? <span>no score</span> : <span>Score: {currScore}</span>}

                    <button className="bg-gray-700 text-white absolute top-1 end-10 border border-gray-700 hover:border-black"
                    hidden={!playing.isPlaying}
                    onKeyDown={() => null} onKeyUp={() => null}
                    onClick={rivemuFullscreen}
                    >
                        <FullscreenIcon/>
                    </button>

                    <button className="bg-red-500 text-white absolute top-1 end-2.5 border border-gray-700 hover:border-black"
                    hidden={!playing.isPlaying}
                    onKeyDown={() => null} onKeyUp={() => null}
                    onClick={rivemuStop}
                    >
                        <StopIcon/>
                    </button>
                </div>
                    <div className="relative">
                    { !playing.isPlaying?
                        <button className={'absolute gameplay-screen text-gray-500 hover:text-white t-0 backdrop-blur-sm border border-gray-500'} onClick={isTape? playTape: playGame}>
                            {
                                playing.playCounter === 0?
                                    <PlayArrowIcon className='text-7xl'/>
                                :
                                    <ReplayIcon className='text-7xl'/>
                            }
                            
                        </button>
                    : <></> }
                        <canvas
                            className='gameplay-screen t-0 border border-gray-500'
                            id="canvas"
                            onContextMenu={(e) => e.preventDefault()}
                            tabIndex={-1}
                            style={{
                                imageRendering: "pixelated",
                                objectFit: "contain"
                            }}
                        />
                    </div>
                </div>
                {isTape ? 
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${currProgress}%`}}></div>
                </div>
                : <></>}
            </section>
            <Script src="/rivemu.js?" strategy="lazyOnload" />
            <Script src="/initializeRivemu.js?" strategy="lazyOnload" />
        </main>
    )
}

export default RivemuPlayer