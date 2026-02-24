const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const clientsRoutes = require('./clients');
const loansRoutes = require('./loans');
const installmentsRoutes = require('./installments');
const collectionsRoutes = require('./collections');
const expensesRoutes = require('./expenses');
const ledgerRoutes = require('./ledger');
const dashboardRoutes = require('./dashboard');
const reportsRoutes = require('./reports');
const chitsRoutes = require('./chits');
const { requireAuth } = require('../middleware/auth');

const rootRouter = express.Router();
const api = express.Router();

rootRouter.use(healthRoutes);
api.use('/auth', authRoutes);
api.use(requireAuth);
api.use('/clients', clientsRoutes);
api.use('/loans', loansRoutes);
api.use('/installments', installmentsRoutes);
api.use('/collections', collectionsRoutes);
api.use('/expenses', expensesRoutes);
api.use('/ledger', ledgerRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/reports', reportsRoutes);
api.use('/chits', chitsRoutes);

rootRouter.use('/api/v1', api);

module.exports = { rootRouter };
