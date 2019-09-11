import { createMockGun } from "../../contact-api/__mocks__/mock-gun.js";

import { injectSeaMockToGun } from "../../contact-api/testing.js";

const Gun = () => {
  const gun = createMockGun();

  injectSeaMockToGun(gun);

  return gun;
};

export default Gun;
