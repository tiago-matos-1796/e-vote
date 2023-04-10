import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from "cookie-parser";
import compress from 'compression';
import methodOverride from 'method-override';
import helmet from 'helmet';
import cors from 'cors';
import routes from '../routes/index.route';

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(cookieParser());
app.use(compress());
app.use(methodOverride());
app.use(helmet());
app.use(cors());
app.use('/e-vote', routes);

export default app;