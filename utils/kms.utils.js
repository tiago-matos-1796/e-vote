const axios = require("axios");
const { KMSEncrypt, KMSDecrypt } = require("../services/encryption.service");

async function kmsConnection() {
  const uri = `${process.env.KMS_URI}keys/`;
  try {
    return await axios.get(uri, {
      headers: {
        "access-token": process.env.KMS_TOKEN,
        "Content-type": "application/json",
      },
    });
  } catch (err) {
    console.log("Could not connect to KMS");
  }
}

async function insertSignature(id, publicKey, privateKey, iv, tag) {
  const keyObj = {
    _id: id,
    public_key: publicKey,
    private_key: privateKey,
    iv: iv,
    tag: tag,
  };
  const uri = `${process.env.KMS_URI}keys/user`;
  return await axios
    .post(
      uri,
      { data: KMSEncrypt(JSON.stringify(keyObj)) },
      {
        headers: {
          "access-token": process.env.KMS_TOKEN,
          "Content-type": "application/json",
        },
      }
    )
    .then((response) => {
      return response;
    })
    .catch((error) => {
      return error;
    });
}

async function insertElectionKeys(id, publicKey, privateKey, iv, tag) {
  const keyObj = {
    _id: id,
    public_key: publicKey,
    private_key: privateKey,
    iv: iv,
    tag: tag,
  };
  const uri = `${process.env.KMS_URI}keys/election`;
  return await axios
    .post(
      uri,
      { data: KMSEncrypt(JSON.stringify(keyObj)) },
      {
        headers: {
          "access-token": process.env.KMS_TOKEN,
          "Content-type": "application/json",
        },
      }
    )
    .then((response) => {
      return response;
    })
    .catch((error) => {
      return error;
    });
}

async function getElectionPublicKey(id) {
  const uri = `${process.env.KMS_URI}keys/election/public/${id}`;
  try {
    const key = await axios.get(uri, {
      headers: {
        "access-token": process.env.KMS_TOKEN,
        "Content-type": "application/json",
      },
    });
    return JSON.parse(KMSDecrypt(key.data));
  } catch (err) {
    return err;
  }
}

async function getElectionPrivateKey(id) {
  const uri = `${process.env.KMS_URI}keys/election/private/${id}`;
  try {
    const key = await axios.get(uri, {
      headers: {
        "access-token": process.env.KMS_TOKEN,
        "Content-type": "application/json",
      },
    });
    return JSON.parse(KMSDecrypt(key.data));
  } catch (err) {
    return err;
  }
}

async function getSignaturePrivateKey(id) {
  const uri = `${process.env.KMS_URI}keys/user/private/${id}`;
  try {
    const key = await axios.get(uri, {
      headers: {
        "access-token": process.env.KMS_TOKEN,
        "Content-type": "application/json",
      },
    });
    return JSON.parse(KMSDecrypt(key.data));
  } catch (err) {
    return err;
  }
}

async function getSignaturePublicKey(id) {
  const uri = `${process.env.KMS_URI}keys/user/public/${id}`;
  try {
    const key = await axios.get(uri, {
      headers: {
        "access-token": process.env.KMS_TOKEN,
        "Content-type": "application/json",
      },
    });
    return JSON.parse(KMSDecrypt(key.data));
  } catch (err) {
    return err;
  }
}

async function updateElectionKeys(id, publicKey, privateKey, iv, tag) {
  const uri = `${process.env.KMS_URI}keys/election/${id}`;
  const keyObj = {
    public_key: publicKey,
    private_key: privateKey,
    iv: iv,
    tag: tag,
  };
  return await axios
    .patch(
      uri,
      { data: KMSEncrypt(JSON.stringify(keyObj)) },
      {
        headers: {
          "access-token": process.env.KMS_TOKEN,
          "Content-type": "application/json",
        },
      }
    )
    .then((response) => {
      return response;
    })
    .catch((error) => {
      return error;
    });
}

async function updateSignatureKeys(id, publicKey, privateKey, iv, tag) {
  const uri = `${process.env.KMS_URI}keys/user/${id}`;
  const keyObj = {
    public_key: publicKey,
    private_key: privateKey,
    iv: iv,
    tag: tag,
  };
  return await axios
    .patch(
      uri,
      { data: KMSEncrypt(JSON.stringify(keyObj)) },
      {
        headers: {
          "access-token": process.env.KMS_TOKEN,
          "Content-type": "application/json",
        },
      }
    )
    .then((response) => {
      return response;
    })
    .catch((error) => {
      return error;
    });
}

async function deleteElectionKeys(id) {
  const uri = `${process.env.KMS_URI}keys/election/${id}`;
  return await axios
    .delete(uri, {
      headers: {
        "access-token": process.env.KMS_TOKEN,
        "Content-type": "application/json",
      },
    })
    .then((response) => {
      return response;
    })
    .catch((error) => {
      return error;
    });
}

async function deleteSignatureKeys(id) {
  const uri = `${process.env.KMS_URI}keys/user/${id}`;
  return await axios
    .delete(uri, {
      headers: {
        "access-token": process.env.KMS_TOKEN,
        "Content-type": "application/json",
      },
    })
    .then((response) => {
      return response;
    })
    .catch((error) => {
      return error;
    });
}

module.exports = {
  kmsConnection,
  insertSignature,
  insertElectionKeys,
  getElectionPublicKey,
  getElectionPrivateKey,
  getSignaturePrivateKey,
  getSignaturePublicKey,
  deleteElectionKeys,
  deleteSignatureKeys,
  updateElectionKeys,
  updateSignatureKeys,
};
