const crypto = require('crypto');
const {Buffer} = require("buffer");
const algorithm = 'aes-128-cbc';
const signature_hash = 'SHA256';

function generateKeys(key) {
    const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
        },
    });
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encryptedData = cipher.update(privateKey.toString(), 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    return {publicKey: Buffer.from(publicKey).toString('base64'), privateKey: encryptedData, iv: Buffer.from(iv).toString('base64')};
}

function encrypt(data, publicKey) {
    return crypto.publicEncrypt(Buffer.from(publicKey, 'base64').toString('utf8'), Buffer.from(data)).toString('base64');
}

function decrypt(encryptedData, privateKey, key, iv) {
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'base64'));
    let decryptedData = decipher.update(privateKey, 'base64', "utf8");
    decryptedData += decipher.final('utf8');
    return crypto.privateDecrypt(decryptedData, Buffer.from(encryptedData, 'base64')).toString('utf8');
}

function generateSignatureKeys(key) {
    const {privateKey, publicKey} = crypto.generateKeyPairSync('ec', {
        namedCurve: 'sect233k1',
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
        },
    });
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encryptedData = cipher.update(privateKey.toString(), 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    return {publicKey: Buffer.from(publicKey).toString('base64'), privateKey: encryptedData, iv: Buffer.from(iv).toString('base64')};
}

function sign(data, privateKey, key, iv) {
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'base64'));
    let decryptedKey = decipher.update(privateKey, 'base64', "utf8");
    decryptedKey += decipher.final('utf8');
    const sign = crypto.sign(signature_hash, Buffer.from(data), decryptedKey);
    return sign.toString('base64');
}

function verify(data, publicKey, signature) {
    return crypto.verify(signature_hash, Buffer.from(data), Buffer.from(publicKey, 'base64').toString('utf8'), Buffer.from(signature, 'base64'));
}

module.exports = {generateKeys, decrypt, encrypt, generateSignatureKeys, sign, verify}