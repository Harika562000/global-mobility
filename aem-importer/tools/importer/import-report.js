function transform({ document, params }) {
  const potentialBlocks = {};
  [...document.querySelectorAll('.ups-component')].forEach((block) => {
    block.classList.remove('ups-component');
    // first remaining class is assumed to be the block name
    const blockName = block.classList[0];
    if (blockName) {
      const blockVariants = potentialBlocks[blockName] || [];
      [...block.classList].slice(1).forEach((className) => {
        if (!blockVariants.includes(className)) {
          blockVariants.push(className);
        }
      });
      potentialBlocks[blockName] = blockVariants;
    }
  });

  const report = {};
  report.potentialBlocks = Object.keys(potentialBlocks);
  Object.entries(potentialBlocks).forEach(([blockName, blockVariants]) => {
    report[blockName] = blockVariants;
  });

  report.PageTitle = document.querySelector('title').textContent;
  report.PageDescription = document.querySelector('meta[name="description"]')?.content;
  report.PageKeywords = document.querySelector('meta[name="keywords"]')?.content;

  return [{
    path: new URL(params.originalURL).pathname.replace(/\/$/, '').replace(/\.page$/, '').toLowerCase(),
    report,
  }];
}

export default {
  transform,
};
