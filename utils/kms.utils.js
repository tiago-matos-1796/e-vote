const axios = require('axios');
const env = process.env;
axios.defaults.headers.common['access-token'] = env.KMS_TOKEN;

async function kmsConnection() {
    const uri = `${env.KMS_URI}keys/`;
    try {
        return await axios.get(uri, {
            headers: {
                "access-token": env.KMS_TOKEN,
                "Content-type": "application/json"
            }
        });
    } catch (err) {
        console.log("Could not connect to KMS");
    }
}

async function insertSignature(id, publicKey, privateKey, iv) {
    const keyObj = {
        _id: id,
        public_key: publicKey,
        private_key: privateKey,
        iv: iv
    };
    const uri = `${env.KMS_URI}keys/user`;
    try {
        return await axios.post(uri, keyObj, {
            headers: {
                "access-token": env.KMS_TOKEN,
                "Content-type": "application/json"
            }
        });
    } catch (err) {
        console.error(err);
    }
}

async function insertElectionKeys(id, publicKey, privateKey, iv) {
    const keyObj = {
        _id: id,
        public_key: publicKey,
        private_key: privateKey,
        iv: iv
    };
    const uri = `${env.KMS_URI}keys/election`;
    try {
        return await axios.post(uri, keyObj, {
            headers: {
                "access-token": env.KMS_TOKEN,
                "Content-type": "application/json"
            }
        });
    } catch (err) {
        console.error(err);
    }
}

async function getElectionPublicKey(id) {
    const uri = `${env.KMS_URI}keys/election/public/${id}`;
    try {
        return await axios.get(uri, {
            headers: {
                "access-token": env.KMS_TOKEN,
                "Content-type": "application/json"
            }
        });
    } catch (err) {
        console.error(err);
    }
}

async function getSignaturePrivateKey(id) {
    const uri = `${env.KMS_URI}keys/user/private/${id}`;
    try {
        return await axios.get(uri, {
            headers: {
                "access-token": env.KMS_TOKEN,
                "Content-type": "application/json"
            }
        });
    } catch (err) {
        console.error(err);
    }
}

async function getSignaturePublicKey(id) {
    const uri = `${env.KMS_URI}keys/user/public/${id}`;
    try {
        return await axios.get(uri, {
            headers: {
                "access-token": env.KMS_TOKEN,
                "Content-type": "application/json"
            }
        });
    } catch (err) {
        console.error(err);
    }
}

async function updateElectionKeys(id, publicKey, privateKey, iv) {
    const uri = `${env.KMS_URI}keys/election/${id}`;
    const keyObj = {
        public_key: publicKey,
        private_key: privateKey,
        iv: iv
    };
    try {
        return await axios.patch(uri, keyObj, {
            headers: {
                "access-token": env.KMS_TOKEN,
                "Content-type": "application/json"
            }
        });
    } catch (err) {
        console.error(err);
    }
}

async function deleteElectionKeys(id) {
    const uri = `${env.KMS_URI}keys/election/${id}`;
    try {
        return await axios.delete(uri, {
            headers: {
                "access-token": env.KMS_TOKEN,
                "Content-type": "application/json"
            }
        });
    } catch (err) {
        console.error(err);
    }
}

module.exports = {
    kmsConnection,
    insertSignature,
    insertElectionKeys,
    getElectionPublicKey,
    getSignaturePrivateKey,
    getSignaturePublicKey,
    deleteElectionKeys,
    updateElectionKeys
}