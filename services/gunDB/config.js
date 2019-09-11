import dotenv from "dotenv";

dotenv.config();

// @ts-ignore Let it crash if undefined
export const DATA_FILE_NAME = process.env.DATA_FILE_NAME;

// @ts-ignore Let it crash if undefined
export const PEERS = JSON.parse(process.env.PEERS);

export const MS_TO_TOKEN_EXPIRATION = Number(
  process.env.MS_TO_TOKEN_EXPIRATION
);
