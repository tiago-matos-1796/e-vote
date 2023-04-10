const express = require('express');
const router = express.Router();

module.exports = app => {
  const userController = require('../controllers/users.controller');
  router.post('/', userController.create);
  router.put('/:id', userController.update);
  app.use('/users', router);
}