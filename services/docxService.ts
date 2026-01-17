
import JSZip from 'jszip';
import { FormatConfig } from '../types';

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

interface QuestionGroup {
  index: number;
  elements: Element[];
}

function getElementText(el: Element): string {
  const tNodes = Array.from(el.getElementsByTagNameNS(W_NS, "t"));
  return tNodes.map(t => t.textContent || "").join("");
}

function scanQuestions(body: Element): QuestionGroup[] {
  const groups: QuestionGroup[] = [];
  const allElements = Array.from(body.childNodes).filter(n => n.nodeType === Node.ELEMENT_NODE) as Element[];
  
  let currentGroup: QuestionGroup | null = null;
  let questionCounter = 0;

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.localName === "p") {
      const text = getElementText(el);
      
      if (/^HẾT\s*$/.test(text) || /^[-]+\s*HẾT\s*[-]+$/.test(text)) {
        currentGroup = null;
        continue; 
      }

      const match = text.match(/^\s*Câu\s+(\d+)[:.]/i);
      if (match) {
        currentGroup = {
          index: questionCounter++,
          elements: [el]
        };
        groups.push(currentGroup);
        continue;
      }
    }

    if (currentGroup) {
      currentGroup.elements.push(el);
    }
  }
  return groups;
}

function cleanExtraSpaces(doc: Document) {
  const tNodes = Array.from(doc.getElementsByTagNameNS(W_NS, "t"));
  for (const t of tNodes) {
    const originalText = t.textContent || "";
    // Regex matches 2 or more spaces, tabs, non-breaking spaces, or various unicode spaces
    if (/[ \t\u00A0\u2002-\u200B]{2,}/.test(originalText)) {
      t.textContent = originalText.replace(/[ \t\u00A0\u2002-\u200B]{2,}/g, " ");
      t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    }
  }
}

function removeEmptyParagraphs(doc: Document) {
  const body = doc.getElementsByTagNameNS(W_NS, "body")[0];
  const paras = Array.from(body.getElementsByTagNameNS(W_NS, "p"));
  
  paras.forEach(p => {
    // Check for images, shapes, page breaks, etc.
    if (p.getElementsByTagNameNS(W_NS, "drawing").length > 0 ||
        p.getElementsByTagNameNS(W_NS, "object").length > 0 || 
        p.getElementsByTagNameNS("urn:schemas-microsoft-com:vml", "shape").length > 0 ||
        Array.from(p.getElementsByTagNameNS(W_NS, "br")).some(br => br.getAttributeNS(W_NS, "type") === "page")) {
      return;
    }

    const text = getElementText(p);
    // Strict empty check
    if (!text || /^[\s\u00A0\u200B]*$/.test(text)) {
        if (p.parentNode) {
            p.parentNode.removeChild(p);
        }
    }
  });
}

function splitParagraphAt(doc: Document, p: Element, run: Element, splitNode: Node): Element {
    const body = p.parentNode!;
    const newP = p.cloneNode(false) as Element;
    
    const pPr = Array.from(p.childNodes).find(n => n.nodeName === "w:pPr");
    if (pPr) {
        newP.appendChild(pPr.cloneNode(true));
    }

    const newRun = run.cloneNode(false) as Element;
    
    let nextNode = splitNode.nextSibling;
    while(nextNode) {
        const toMove = nextNode;
        nextNode = nextNode.nextSibling;
        newRun.appendChild(toMove);
    }
    
    if (newRun.childNodes.length > 0) {
        newP.appendChild(newRun);
    }

    let nextRun = run.nextSibling;
    while(nextRun) {
        const toMove = nextRun;
        nextRun = nextRun.nextSibling;
        newP.appendChild(toMove);
    }

    if (splitNode.parentNode === run) {
        run.removeChild(splitNode);
    }

    if (p.nextSibling) {
        body.insertBefore(newP, p.nextSibling);
    } else {
        body.appendChild(newP);
    }

    return newP;
}

function processParagraphForSplit(doc: Document, p: Element) {
    const runs = Array.from(p.getElementsByTagNameNS(W_NS, "r"));
    let textSoFar = "";

    for (let rIndex = 0; rIndex < runs.length; rIndex++) {
        const run = runs[rIndex];
        const nodes = Array.from(run.childNodes);
        
        for (let nIndex = 0; nIndex < nodes.length; nIndex++) {
            const node = nodes[nIndex];
            
            if (node.nodeName === "w:t") {
                textSoFar += node.textContent;
            } 
            else if (node.nodeName === "w:tab") {
                let lookAheadText = "";
                
                for (let k = nIndex + 1; k < nodes.length; k++) {
                   if (nodes[k].nodeName === "w:t") lookAheadText += nodes[k].textContent;
                }
                for (let k = rIndex + 1; k < runs.length; k++) {
                   const nextRunNodes = runs[k].childNodes;
                   for(let m=0; m<nextRunNodes.length; m++) {
                      if (nextRunNodes[m].nodeName === "w:t") lookAheadText += nextRunNodes[m].textContent;
                   }
                   if (lookAheadText.length > 10) break;
                }

                const isNextIsOption = /^\s*[A-D][.:)]/.test(lookAheadText);
                
                if (isNextIsOption) {
                    const newP = splitParagraphAt(doc, p, run, node);
                    processParagraphForSplit(doc, newP);
                    return;
                } else {
                    const isPrevIsLabel = /(?:^|[\s\u00A0])[A-D][.:)]\s*$/.test(textSoFar) || /^[A-D][.:)]\s*$/.test(textSoFar);
                    if (isPrevIsLabel) {
                         // INTELLIGENT SPACE REPLACEMENT:
                         // If the next text ALREADY starts with a space, replace Tab with EMPTY string.
                         // Otherwise replace with SPACE.
                         const nextCharIsSpace = /^[\s\u00A0]/.test(lookAheadText);
                         const replacement = nextCharIsSpace ? "" : " ";

                         const spaceNode = doc.createElementNS(W_NS, "w:t");
                         if (replacement === " ") {
                            spaceNode.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
                         }
                         spaceNode.textContent = replacement;
                         run.replaceChild(spaceNode, node);
                         
                         textSoFar += replacement;
                    }
                }
            }
        }
    }
}

function standardizeOptions(doc: Document) {
  const body = doc.getElementsByTagNameNS(W_NS, "body")[0];
  let currentP = body.firstElementChild;
  while (currentP) {
      const nextP = currentP.nextSibling as Element;
      if (currentP.localName === "p") {
          const text = getElementText(currentP);
          if (/[A-D][.:)]/.test(text)) {
             processParagraphForSplit(doc, currentP);
          }
      }
      currentP = nextP;
  }
}

function colorBoldText(doc: Document, colorHex: string) { 
  const cleanHex = colorHex.replace('#', '').toUpperCase();
  const runs = doc.getElementsByTagNameNS(W_NS, "r");
  
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const rPr = run.getElementsByTagNameNS(W_NS, "rPr")[0];
    
    if (rPr) {
      const b = rPr.getElementsByTagNameNS(W_NS, "b")[0];
      const val = b ? b.getAttributeNS(W_NS, "val") : null;
      const isBold = b && (val === null || val === "" || val === "1" || val === "true" || val === "on");
      
      if (isBold) {
        let color = rPr.getElementsByTagNameNS(W_NS, "color")[0];
        if (!color) {
          color = doc.createElementNS(W_NS, "w:color");
          rPr.appendChild(color);
        }
        color.setAttributeNS(W_NS, "w:val", cleanHex);
      }
    }
  }
}

function formatOptionLabels(doc: Document, colorHex: string) {
    const cleanHex = colorHex.replace('#', '').toUpperCase();
    const body = doc.getElementsByTagNameNS(W_NS, "body")[0];
    const paras = Array.from(body.getElementsByTagNameNS(W_NS, "p"));

    for (const p of paras) {
        const text = getElementText(p);
        if (/^\s*[A-D][.:)]/.test(text)) {
            const runs = Array.from(p.getElementsByTagNameNS(W_NS, "r"));
            
            for (const run of runs) {
                const textContent = getElementText(run);
                if (/^\s*[A-D][.:)]/.test(textContent)) {
                     let rPr = run.getElementsByTagNameNS(W_NS, "rPr")[0];
                     if (!rPr) {
                         rPr = doc.createElementNS(W_NS, "w:rPr");
                         run.insertBefore(rPr, run.firstChild);
                     }
                     
                     let b = rPr.getElementsByTagNameNS(W_NS, "b")[0];
                     if (!b) {
                         b = doc.createElementNS(W_NS, "w:b");
                         rPr.appendChild(b);
                     }
                     b.setAttributeNS(W_NS, "w:val", "true");

                     let color = rPr.getElementsByTagNameNS(W_NS, "color")[0];
                     if (!color) {
                        color = doc.createElementNS(W_NS, "w:color");
                        rPr.appendChild(color);
                     }
                     color.setAttributeNS(W_NS, "w:val", cleanHex);
                     
                     break; 
                }
            }
        }
    }
}

function centerImagesInDoc(doc: Document) {
    const body = doc.getElementsByTagNameNS(W_NS, "body")[0];
    const paras = Array.from(body.getElementsByTagNameNS(W_NS, "p"));

    paras.forEach(p => {
        // We look for 'drawing' (modern images) or 'pict' (legacy images).
        // IMPORTANT: We do NOT center if it only contains 'object' (OLE like MathType) unless it also has drawing.
        const hasDrawing = p.getElementsByTagNameNS(W_NS, "drawing").length > 0;
        const hasPict = p.getElementsByTagNameNS(W_NS, "pict").length > 0;
        
        // If it has drawings/pictures, we center the paragraph.
        // This avoids breaking inline math (w:object) in normal text paragraphs, 
        // because typical inline math paragraphs won't have w:drawing.
        if (hasDrawing || hasPict) {
             let pPr = p.getElementsByTagNameNS(W_NS, "pPr")[0];
             if (!pPr) {
                 pPr = doc.createElementNS(W_NS, "w:pPr");
                 p.insertBefore(pPr, p.firstChild);
             }
             
             let jc = pPr.getElementsByTagNameNS(W_NS, "jc")[0];
             if (!jc) {
                 jc = doc.createElementNS(W_NS, "w:jc");
                 pPr.appendChild(jc);
             }
             // Set alignment to center
             jc.setAttributeNS(W_NS, "w:val", "center");
        }
    });
}

function insertDotLines(doc: Document, groups: QuestionGroup[], count: number) {
  if (count <= 0) return;
  const body = doc.getElementsByTagNameNS(W_NS, "body")[0];

  const createDotP = () => {
    const p = doc.createElementNS(W_NS, "w:p");
    const r = doc.createElementNS(W_NS, "w:r");
    const t = doc.createElementNS(W_NS, "w:t");
    t.textContent = "......................................................................................................................................................";
    r.appendChild(t);
    p.appendChild(r);
    return p;
  };

  for (const group of groups) {
    if (group.elements.length === 0) continue;

    let lastEl = group.elements[group.elements.length - 1];
    
    if (!body.contains(lastEl)) {
        for(let i = group.elements.length - 1; i >= 0; i--) {
            if(body.contains(group.elements[i])) {
                lastEl = group.elements[i];
                break;
            }
        }
    }

    if (!body.contains(lastEl)) continue;
    
    let refNode = lastEl.nextSibling;
    for (let k = 0; k < count; k++) {
      const dotP = createDotP();
      if (refNode) {
        body.insertBefore(dotP, refNode);
      } else {
        body.appendChild(dotP);
      }
    }
  }
}

export async function processDocx(file: File, config: FormatConfig): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXmlString = await zip.file("word/document.xml")?.async("string");
  if (!docXmlString) throw new Error("Could not find word/document.xml");

  const parser = new DOMParser();
  const doc = parser.parseFromString(docXmlString, "application/xml");
  const body = doc.getElementsByTagNameNS(W_NS, "body")[0];

  if (config.breakTabsToNewlines) {
    standardizeOptions(doc);
  }

  if (config.colorBoldText) {
      formatOptionLabels(doc, config.boldColor);
  }

  // Run space cleaner AFTER splitting to catch any artifacts
  if (config.removeExtraSpaces) {
    cleanExtraSpaces(doc);
  }

  if (config.colorBoldText) {
    colorBoldText(doc, config.boldColor);
  }

  if (config.centerImages) {
    centerImagesInDoc(doc);
  }
  
  if (config.removeEmptyLines) {
    removeEmptyParagraphs(doc);
  }

  if (config.dotLinesCount > 0) {
    const groups = scanQuestions(body);
    insertDotLines(doc, groups, config.dotLinesCount);
  }

  const serializer = new XMLSerializer();
  const newXmlString = serializer.serializeToString(doc);

  zip.file("word/document.xml", newXmlString);
  const content = await zip.generateAsync({ type: "blob" });
  return URL.createObjectURL(content);
}
