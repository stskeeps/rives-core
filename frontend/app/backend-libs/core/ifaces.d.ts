/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface _Master_ {
  InserCartridgePayload: InserCartridgePayload;
  VerificationOutput: VerificationOutput;
  RulesOutput: RulesOutput;
  RuleCreated: RuleCreated;
  CartridgePayloadSplittable: CartridgePayloadSplittable;
  GetRulesPayload: GetRulesPayload;
  VerifyPayload: VerifyPayload;
  CartridgeInfo: CartridgeInfo;
  RuleData: RuleData;
  CartridgesPayload: CartridgesPayload;
  CartridgeInserted: CartridgeInserted;
  CartridgesOutput: CartridgesOutput;
  CartridgeRemoved: CartridgeRemoved;
  CartridgePayload: CartridgePayload;
  RemoveCartridgePayload: RemoveCartridgePayload;
}
export interface InserCartridgePayload {
  data: string;
}
export interface VerificationOutput {
  version: string;
  cartridge_id: string;
  cartridge_input_index: number;
  user_address: string;
  timestamp: number;
  score: number;
  rule_id: string;
  rule_input_index: number;
  tape_hash: string;
  tape_input_index: number;
}
export interface RulesOutput {
  data: RuleInfo[];
  total: number;
  page: number;
}
export interface RuleInfo {
  id: string;
  name: string;
  description: string;
  cartridge_id: string;
  created_by: string;
  created_at: number;
  args: string;
  in_card: string;
  score_function: string;
}
export interface RuleCreated {
  rule_id: string;
  created_by: string;
  created_at: number;
}
export interface CartridgePayloadSplittable {
  id: string;
  part?: number;
}
export interface GetRulesPayload {
  cartridge_id?: string;
  id?: string;
  name?: string;
  page?: number;
  page_size?: number;
}
export interface VerifyPayload {
  rule_id: string;
  outcard_hash: string;
  tape: string;
  claimed_score: number;
}
export interface CartridgeInfo {
  id: string;
  name: string;
  user_address: string;
  info?: CartridgeInfo1;
  created_at: number;
  cover?: string;
}
export interface CartridgeInfo1 {
  name: string;
  summary?: string;
  description?: string;
  version?: string;
  status?: string;
  tags: string[];
  authors?: Author[];
  url?: string;
}
export interface Author {
  name: string;
  link: string;
}
export interface RuleData {
  cartridge_id: string;
  name: string;
  description: string;
  args: string;
  in_card: string;
  score_function: string;
}
export interface CartridgesPayload {
  name?: string;
  tags?: string[];
  page?: number;
  page_size?: number;
}
export interface CartridgeInserted {
  cartridge_id: string;
  user_address: string;
  timestamp: number;
}
export interface CartridgesOutput {
  data: CartridgeInfo[];
  total: number;
  page: number;
}
export interface CartridgeRemoved {
  cartridge_id: string;
  timestamp: number;
}
export interface CartridgePayload {
  id: string;
}
export interface RemoveCartridgePayload {
  id: string;
}
