const express = require('express');
const router = express.Router();
const userRoutes = require('./users.route');
const electionRoutes = require('./election.route');
const voteRoutes = require('./statistics.route');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.use('/users', userRoutes);
router.use('/elections', electionRoutes);
router.use('/vote', voteRoutes);
module.exports = router;
