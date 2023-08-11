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

async function insertSignature(id, publicKey, privateKey, iv) {
  const keyObj = {
    _id: id,
    public_key: publicKey,
    private_key: privateKey,
    iv: iv,
  };
  const uri = `${process.env.KMS_URI}keys/user`;
  try {
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
      .then(() => {
        return 1;
      })
      .catch(() => {
        return 0;
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
    iv: iv,
  };
  const uri = `${process.env.KMS_URI}keys/election`;
  try {
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
      .then(() => {
        return 1;
      })
      .catch(() => {
        return 0;
      });
  } catch (err) {
    console.error(err);
  }
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
    console.error(err);
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
    console.error(err);
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
    console.error(err);
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
    console.error(err);
  }
}

async function updateElectionKeys(id, publicKey, privateKey, iv) {
  const uri = `${process.env.KMS_URI}keys/election/${id}`;
  const keyObj = {
    public_key: publicKey,
    private_key: privateKey,
    iv: iv,
  };
  try {
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
      .then(() => {
        return 1;
      })
      .catch(() => {
        return 0;
      });
  } catch (err) {
    console.error(err);
  }
}

async function updateSignatureKeys(id, publicKey, privateKey, iv) {
  const uri = `${process.env.KMS_URI}keys/user/${id}`;
  const keyObj = {
    public_key: publicKey,
    private_key: privateKey,
    iv: iv,
  };
  try {
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
      .then(() => {
        return 1;
      })
      .catch(() => {
        return 0;
      });
  } catch (err) {
    console.error(err);
  }
}

async function deleteElectionKeys(id) {
  const uri = `${process.env.KMS_URI}keys/election/${id}`;
  try {
    return await axios
      .delete(uri, {
        headers: {
          "access-token": process.env.KMS_TOKEN,
          "Content-type": "application/json",
        },
      })
      .then(() => {
        return 1;
      })
      .catch(() => {
        return 0;
      });
  } catch (err) {
    console.error(err);
  }
}

async function deleteSignatureKeys(id) {
  const uri = `${process.env.KMS_URI}keys/user/${id}`;
  try {
    return await axios
      .delete(uri, {
        headers: {
          "access-token": process.env.KMS_TOKEN,
          "Content-type": "application/json",
        },
      })
      .then(() => {
        return 1;
      })
      .catch(() => {
        return 0;
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
  getElectionPrivateKey,
  getSignaturePrivateKey,
  getSignaturePublicKey,
  deleteElectionKeys,
  deleteSignatureKeys,
  updateElectionKeys,
  updateSignatureKeys,
};
