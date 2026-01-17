
export const LATEX_TEMPLATES = {
  PREAMBLE: `
\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{vietnam}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage[loigiai]{ex_test}
\\begin{document}
  `,
  POSTAMBLE: `
\\end{document}
  `
};

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg'
];
