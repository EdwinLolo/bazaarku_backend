const auth = require("./auth_controller.js");
const rental = require("./rental_controller.js");
const rentalProducts = require("./rental_products_controller.js");
const banner = require("./banner_controller.js");

const controller = {};

controller.auth = auth;
controller.rental = rental;
controller.rentalProducts = rentalProducts;
controller.banner = banner;

module.exports = controller;
