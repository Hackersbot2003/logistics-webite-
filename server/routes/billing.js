const router = require('express').Router();
const ctrl   = require('../controllers/billingController');
const { protect, authorize } = require('../middleware/auth');

const canWrite  = authorize('superadmin','admin','manager');
const canDelete = authorize('superadmin','admin');

router.use(protect);

router.get('/sheets',              ctrl.getSheets);
router.post('/sheets',             canWrite, ctrl.createSheet);
router.put('/sheets/:id/lock',     canWrite, ctrl.lockSheet);
router.put('/sheets/:id/status',   canWrite, ctrl.updateSheetStatus);
router.delete('/sheets/:id',       canDelete, ctrl.deleteSheet);
router.get('/sheets/:sheetName/records', ctrl.getSheetRecords);

router.get('/preview',   ctrl.previewBilling);
router.post('/generate', canWrite, ctrl.generateBill);
router.get('/pdf/:id',   ctrl.generatePDF);
router.delete('/records/:id', canDelete, ctrl.deleteBillRecord);
router.get('/annexure',  ctrl.generateAnnexurePDF);
router.get('/toll-pdf',  ctrl.generateTollPDF);

module.exports = router;