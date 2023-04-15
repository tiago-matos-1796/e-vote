const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');

module.exports = app => {
    const electionController = require('../controllers/election.controller');
    router.get('/', auth, electionController.list);
    router.get('/:id', auth, electionController.show);
    router.post('/', auth, electionController.create);
    router.put('/:id', auth, electionController.update);
    router.delete('/:id', auth, electionController.remove);
    router.post('/vote', auth, electionController.vote);
    router.get('/vote', auth, electionController.showResults);
    app.use('/elections', router);
}