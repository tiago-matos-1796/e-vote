import Sequelize from 'sequelize';
import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import config from './config';

const db = {};

const sequelize = new Sequelize(
    config.postgres.db,
    config.postgres.user,
    config.postgres.password,
    {
        dialect: 'postgres',
        port: config.postgres.port,
        host: config.postgres.host,
    },
);

const modelsDir = path.normalize(`${__dirname}/../models`);
fs
    .readdirSync(modelsDir)
    .filter(file => file.indexOf('.') !== 0 && file.indexOf('.map') === -1)
    // import model files and save model names
    .forEach((file) => {
        console.info(`Loading model file ${file}`);
        const model = sequelize.import(path.join(modelsDir, file));
        db[model.name] = model;
    });
Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});
sequelize.sync().then((err) => {
    if (err) console.error('An error occured %j', err);
    else console.info('Database synchronized');
});
module.exports = _.extend(
    {
        sequelize,
        Sequelize,
    },
    db,
);