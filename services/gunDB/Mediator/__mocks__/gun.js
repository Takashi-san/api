const { createMockGun } = require("../../contact-api/__mocks__/mock-gun");

const { injectSeaMockToGun } = require("../../contact-api/testing");

const Gun = () => {
  const gun = createMockGun();

  injectSeaMockToGun(gun);

  return gun;
};

module.exports = Gun;
