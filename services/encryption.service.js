const crypto = require("crypto");
const { Buffer } = require("buffer");
const algorithm = "aes-128-gcm";
const internal_algorithm = "aes-256-gcm";
const signature_hash = "SHA256";
const ECDSA_curve = "sect571k1";

function generateKeys(key) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encryptedData = cipher.update(privateKey.toString(), "utf8", "base64");
  encryptedData += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return {
    publicKey: Buffer.from(publicKey).toString("base64"),
    privateKey: encryptedData,
    iv: Buffer.from(iv).toString("base64"),
    tag: tag.toString("base64"),
  };
}

function encrypt(data, publicKey) {
  return crypto
    .publicEncrypt(
      Buffer.from(publicKey, "base64").toString("utf8"),
      Buffer.from(data)
    )
    .toString("base64");
}

function decrypt(encryptedData, privateKey, key, iv, tag) {
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  let decryptedData = decipher.update(privateKey, "base64", "utf8");
  decryptedData += decipher.final("utf8");
  return crypto
    .privateDecrypt(decryptedData, Buffer.from(encryptedData, "base64"))
    .toString("utf8");
}

function generateSignatureKeys(key) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: ECDSA_curve,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encryptedData = cipher.update(privateKey.toString(), "utf8", "base64");
  encryptedData += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return {
    publicKey: Buffer.from(publicKey).toString("base64"),
    privateKey: encryptedData,
    iv: Buffer.from(iv).toString("base64"),
    tag: tag.toString("base64"),
  };
}

function sign(data, privateKey, key, iv, tag) {
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  let decryptedKey = decipher.update(privateKey, "base64", "utf8");
  decryptedKey += decipher.final("utf8");
  const sign = crypto.sign(signature_hash, Buffer.from(data), decryptedKey);
  return sign.toString("base64");
}

function verify(data, publicKey, signature) {
  return crypto.verify(
    signature_hash,
    Buffer.from(data),
    Buffer.from(publicKey, "base64").toString("utf8"),
    Buffer.from(signature, "base64")
  );
}

function createHash(data, secret) {
  const hmac = crypto.createHmac(process.env.VOTE_HASH, secret);
  hmac.update(data);
  return hmac.digest("base64");
}

function internalEncrypt(data) {
  const cipher = crypto.createCipheriv(
    internal_algorithm,
    process.env.INTERNAL_AES_KEY,
    Buffer.from(process.env.INTERNAL_AES_IV, "base64")
  );
  let encryptedData = cipher.update(data, "utf8", "base64");
  encryptedData += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return encryptedData + "$$" + tag.toString("base64");
}

function internalDecrypt(data) {
  const decipher = crypto.createDecipheriv(
    internal_algorithm,
    process.env.INTERNAL_AES_KEY,
    Buffer.from(process.env.INTERNAL_AES_IV, "base64")
  );
  const dataSplit = data.split("$$");
  decipher.setAuthTag(Buffer.from(dataSplit[1], "base64"));
  let decryptedData = decipher.update(dataSplit[0], "base64", "utf8");
  decryptedData += decipher.final("utf8");
  return decryptedData;
}

function KMSEncrypt(data) {
  const cipher = crypto.createCipheriv(
    internal_algorithm,
    process.env.KMS_AES_KEY,
    Buffer.from(process.env.KMS_AES_IV, "base64")
  );
  let encryptedData = cipher.update(data, "utf8", "base64");
  encryptedData += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return encryptedData + "$$" + tag.toString("base64");
}

function KMSDecrypt(data) {
  const decipher = crypto.createDecipheriv(
    internal_algorithm,
    process.env.KMS_AES_KEY,
    Buffer.from(process.env.KMS_AES_IV, "base64")
  );
  const dataSplit = data.split("$$");
  decipher.setAuthTag(Buffer.from(dataSplit[1], "base64"));
  let decryptedData = decipher.update(dataSplit[0], "base64", "utf8");
  decryptedData += decipher.final("utf8");
  return decryptedData;
}

module.exports = {
  generateKeys,
  decrypt,
  encrypt,
  generateSignatureKeys,
  sign,
  verify,
  createHash,
  internalEncrypt,
  internalDecrypt,
  KMSEncrypt,
  KMSDecrypt,
};
