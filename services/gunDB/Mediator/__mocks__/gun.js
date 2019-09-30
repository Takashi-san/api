const { createMockGun } = require("../../contact-api/__mocks__/mock-gun");

const Gun = () => {
  const gun = createMockGun();

  return gun;
};

module.exports = Gun;
