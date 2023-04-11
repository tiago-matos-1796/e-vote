const express = require('express');
const router = express.Router();

module.exports = app => {
  const userController = require('../controllers/users.controller');
  router.post('/', userController.register);
  router.post('/login', userController.login);
  router.put('/:id', userController.update);
  app.use('/users', router);
}