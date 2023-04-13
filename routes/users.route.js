const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

module.exports = app => {
  const userController = require('../controllers/users.controller');
  router.post('/', userController.register);
  router.post('/login', userController.login);
  router.put('/:id', auth, userController.update);
  router.delete('/:id', auth, userController.remove);
  router.patch('/:id', auth, userController.changePermissions);
  app.use('/users', router);
}