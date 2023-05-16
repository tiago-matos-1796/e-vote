const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');

module.exports = app => {
    const electionController = require('../controllers/election.controller');
    router.get('/voter', auth, electionController.listByVoter);
    router.get('/manager', auth, electionController.listByManager);
    router.get('/:id', auth, electionController.showBallot);
    router.get('/manager/:id', auth, electionController.managerShow);
    router.post('/', auth, electionController.create);
    router.put('/:id', auth, electionController.update);
    router.delete('/:id', auth, electionController.remove);
    router.patch('/:id', auth, electionController.regenerateKeys);
    app.use('/elections', router);
}