const dotenv = require("dotenv");

dotenv.config();

// @ts-ignore Let it crash if undefined
exports.DATA_FILE_NAME = process.env.DATA_FILE_NAME;

// @ts-ignore Let it crash if undefined
exports.PEERS = JSON.parse(process.env.PEERS);

exports.MS_TO_TOKEN_EXPIRATION = Number(process.env.MS_TO_TOKEN_EXPIRATION);
