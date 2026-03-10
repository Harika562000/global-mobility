import { createBlock } from './util.js';

const createBackToTop = (main) => {
  const backToTop = main.querySelector('.back-to-top');
  if (!backToTop) return;

  const block = createBlock('Back To Top Button', [['']]);
  main.append(block);
};

export default createBackToTop;
