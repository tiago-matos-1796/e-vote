# Secure Vote

Secure Vote is an Express.js REST API for handling elections.

## Requirements

* [PostgreSQL](https://www.postgresql.org)
* [Cassandra](https://cassandra.apache.org/_/index.html)

## Setup

### PostgreSQL and Cassandra

Assuming both are installed use both schemas in **schemas** folder.

On **configs/cassandra.config.js**, change **contactPoints** and **keyspace** accordingly:
* **contactPoints** are the IPs or hostnames where nodes are located, especially important if nodes are on different servers.
* **keyspace** is the cluster name.

### .env

Create **.env** file on root folder, following **.env-template** file:

```dotenv
PORT=port number for the API
JWT_SECRET=secret for JWT token creation and verification
DB_NAME=postgresql database name
DB_PORT=postgresql database port
DB_HOST=postgresql database host
DB_USER=postgresql database username
DB_PASSWORD=postgresql database password
DIALECT=database dialect, i.e. postgres
CASSANDRA_USER=cassandra username
CASSANDRA_PASS=cassandra password
KMS_URI=URI of KMS API
KMS_TOKEN=token for authentication on KMS API, must be registered on KMS API
VOTE_HASH=sha512 **hash for vote integrity check, advisable not to change
FRONTEND_URI=URI of frontend application
INTERNAL_AES_KEY=AES key for internal encryption usage
INTERNAL_AES_IV=AES IV for internal encryption usage
SMTP_PORT=SMTP port number
SMTP_HOST=SMTP host
SMTP_USER=SMTP username
SMTP_PASS=SMTP password
BULKREGISTER_TOKEN=token for bulk registering users via email, discard if not needed
```
Internal encryption uses CBC mode for AES, which requires an IV, IV must be in **base64** format. See Node.js [Crypto](https://nodejs.org/api/crypto.html#class-cipher) Cipher class documentation for more information.

If AES mode is changed, change or add lines accordingly.

If KMS_URI and/or FRONTEND_URI are not set several endpoints will not work properly and content will not be shown on any application that calls Secure Vote's endpoints.

If you choose not to use the frontend application designed for this API please see **ElectionBallot.vue** component to see how vote encryption is performed.

## Installation

Use the package manager [npm](https://www.npmjs.com) to install Secure Vote dependencies.

```bash
npm install
```

## Usage

Use the package manager [npm](https://www.npmjs.com) to start Secure Vote.

```bash
npm start
```
