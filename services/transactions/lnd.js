const getPayments = (lightning, { itemsPerPage, page, paginate = true }) =>
  new Promise((resolve, reject) => {
    lightning.listPayments({}, async (err, { payments = [] } = {}) => {
      if (err) {
        logger.debug("ListPayments Error:", err);
        const health = await checkHealth();
        if (health.LNDStatus.success) {
          err.error = err.message;
          res.status(400).send({ message: err.message, success: false });
        } else {
          res.status(500);
          res.send({ message: health.LNDStatus.message, success: false });
        }
      } else {
        logger.debug("ListPayments:", payments);
        if (paginate) {
          resolve(getListPage({ entries: payments, itemsPerPage, page }));
        } else {
          resolve({ payments });
        }
      }
    });
  });
