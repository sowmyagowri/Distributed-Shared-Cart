var express = require('express');
var router = express.Router();

var Product = require('../models/product');
var Cart = require('../models/cart');
var Order = require('../models/order');

/* GET home page. */
router.get('/', function(req, res, next) {
	var successMsg = req.flash('success')[0];
	Product.find(function(err, docs) { //MongoDB query
		var productChunks = [];
		/*we have to render 3 thumbnails on each row 
		since each thumbnamil takes 4 units of size out of total 12 units*/
		var chunkSize = 3; 
		for(var i = 0; i < docs.length; i += chunkSize) {
			productChunks.push(docs.slice(i, i + chunkSize));
		}
		res.render('shop/index', { title: 'Shopping Cart', products: productChunks, successMsg: successMsg, noMessages: !successMsg });
	});  
});

router.get('/add-to-cart/:id', function(req, res, next) {
	var productId = req.params.id;
	var cart = new Cart(req.session.cart ? req.session.cart : {});

	Product.findById(productId, function(err, product) {
		if(err) {
			return res.redirect('/');
		}
		cart.add(product, product.id);
		req.session.cart = cart; //storing the cart into the session
		console.log(req.session.cart);
		res.redirect('/');
	});
});

router.get('/shopping-cart', function(req, res, next) {
	if(!req.session.cart) {
		return res.render('shop/shopping-cart', {products: null});
	}
	var cart = new Cart(req.session.cart);
	res.render('shop/shopping-cart', {products: cart.generateArray(), totalPrice: cart.totalPrice});
});

router.get('/checkout', isLoggedIn, function(req, res, next) {
	if(!req.session.cart) {
		return res.redirect('/shopping-cart');
	}
	var cart = new Cart(req.session.cart);
	var errMsg = req.flash('error')[0];
	res.render('shop/checkout', {total: cart.totalPrice, errMsg: errMsg, noError: !errMsg});
});

router.post('/checkout', isLoggedIn, function(req, res, next) {
	if(!req.session.cart) {
		return res.redirect('/shopping-cart');
	}
	var cart = new Cart(req.session.cart);
	
	var stripe = require("stripe") (
		"sk_test_40js2PZJzkdzlsXhrQX7MqOg"
	);

	stripe.charges.create({
		amount: cart.totalPrice * 100,
		currency: "usd",
		source: req.body.stripeToken,
		description: "Test Charge"
	}, function(err, charge) {
		if(err){
			req.flash('error', err.message);
			return res.redirect('/checkout');
		}
		//create order json object to store into the databse
		var order = new Order({
			user: req.user,
			cart: cart,
			address: req.body.address,
			name: req.body.name,
			paymentId: charge.id
		});
		//store the order json into the mongodb
		order.save(function(err, result){
			req.flash('success', 'Successfully bought the Book !!!');
			req.session.cart = null;
			res.redirect('/');
		});
	});
});

function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	req.session.oldUrl = req.url;
	res.redirect('/user/signin');
}

module.exports = router;