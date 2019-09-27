const os = require("os");
const platform = os.platform();
const homeDir = os.homedir();

const getLndDirectory = () => {
  const { APPDATA } = process.env;
  if (platform === "darwin") {
    return homeDir + "/Library/Application Support/Lnd";
  } else if (platform === "win32") {
    return path.resolve(APPDATA, "../Local/Lnd");
  } else {
    return homeDir + "/.lnd";
  }
};

const parsePath = path => {
  if (platform === "win32") {
    return path.replace("/", "\\");
  }

  return path;
};

const lndDirectory = getLndDirectory();

module.exports = {
  serverPort: 9835,
  serverHost: "localhost",
  lndProto: parsePath(`${__dirname}/rpc.proto`),
  lndHost: "localhost:10009",
  // lndCertPath: __dirname + "/../lnd.cert",
  // macaroonPath: __dirname + "/../admin.macaroon",
  lndCertPath: parsePath(`${lndDirectory}/tls.cert`),
  macaroonPath: parsePath(
    `${lndDirectory}/data/chain/bitcoin/testnet/admin.macaroon`
  ),
  dataPath: parsePath(`${lndDirectory}/data`),
  loglevel: "info",
  logfile: "lncliweb.log",
  lndLogFile: parsePath(`${lndDirectory}/logs/bitcoin/testnet/lnd.log`)
};
