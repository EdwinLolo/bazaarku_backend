const auth = require("./auth_controller.js");
const rental = require("./rental_controller.js");
const rentalProducts = require("./rental_products_controller.js");
const banner = require("./banner_controller.js");
const eventCategory = require("./event_category_controller.js");
const area = require("./area_controller.js");
const vendor = require("./vendor_controller.js");
const booth = require("./booth_controller.js");
const rating = require("./rating_controller.js");

const controller = {};

controller.auth = auth;
controller.rental = rental;
controller.rentalProducts = rentalProducts;
controller.banner = banner;
controller.eventCategory = eventCategory;
controller.area = area;
controller.vendor = vendor;
controller.booth = booth;
controller.rating = rating;

module.exports = controller;
