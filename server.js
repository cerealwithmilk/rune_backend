const application = require('./modules/application');

application.get('/', (req, res) => res.redirect('https://discord.gg/runesoftware'));
application.use('/checkpoint', require('./routes/checkpoint'));

application.use((req, res) => res.status(404).json({ error: true, message: "The requested resource was not found" }));