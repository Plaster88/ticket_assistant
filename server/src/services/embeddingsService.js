// embeddingsService.js — lightweight, local embedding/index prototype.
// Uses a simple token TF vectorization (no external embedding model) to
// provide a searchable vector store for the PoC.

import { getAllKnowledgeDocs, upsertKnowledgeEmbedding, getAllKnowledgeEmbeddings } from './dbService.js';

// Small set of english stopwords for tokenization.
const STOPWORDS = new Set([
  'the','and','is','in','at','of','a','an','to','for','on','with','by','from','that','this','it','as','are','be','or','which','we','you','your','will'
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

function termFrequency(tokens) {
  const tf = Object.create(null);
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  // convert counts to raw term frequency (could normalize if desired)
  return tf;
}

function vectorNorm(sparse) {
  let sum = 0;
  for (const k in sparse) sum += sparse[k] * sparse[k];
  return Math.sqrt(sum);
}

function cosineSimilarity(sparseA, normA, sparseB, normB) {
  if (normA === 0 || normB === 0) return 0;
  let dot = 0;
  // iterate over smaller object for efficiency
  const keysA = Object.keys(sparseA);
  const keysB = Object.keys(sparseB);
  if (keysA.length <= keysB.length) {
    for (const k of keysA) {
      if (sparseB[k]) dot += sparseA[k] * sparseB[k];
    }
  } else {
    for (const k of keysB) {
      if (sparseA[k]) dot += sparseA[k] * sparseB[k];
    }
  }
  return dot / (normA * normB);
}

export async function buildIndex() {
  const docs = getAllKnowledgeDocs();
  let count = 0;
  for (const doc of docs) {
    const tokens = tokenize(`${doc.title} ${doc.content}`);
    const tf = termFrequency(tokens);
    const norm = vectorNorm(tf);
    try {
      upsertKnowledgeEmbedding(doc.id, JSON.stringify(tf), norm);
      count++;
    } catch (err) {
      console.error('[embeddingsService] upsert failed for', doc.id, err.message);
    }
  }
  return count;
}

export async function querySimilarDocs(query, topK = 5) {
  if (!query || typeof query !== 'string') return [];
  // Build query vector
  const tokens = tokenize(query);
  const qTf = termFrequency(tokens);
  const qNorm = vectorNorm(qTf);

  const stored = getAllKnowledgeEmbeddings();
  if (!stored || stored.length === 0) return [];

  // compute similarity scores
  const scored = [];
  for (const row of stored) {
    let docVec;
    try {
      docVec = JSON.parse(row.vector);
    } catch (e) {
      continue;
    }
    const sim = cosineSimilarity(qTf, qNorm, docVec, row.norm);
    scored.push({ doc_id: row.doc_id, score: sim });
  }

  // Improve ranking by blending vector similarity with token overlap
  const docsAll = getAllKnowledgeDocs();
  const qSet = new Set(tokens);

  const enriched = scored
    .map((s) => {
      const doc = docsAll.find((d) => d.id === s.doc_id);
      if (!doc) return null;
      const docTokens = tokenize(`${doc.title} ${doc.content}`);
      const docSet = new Set(docTokens);
      // token overlap normalized by smaller set size
      const intersection = [...qSet].filter((t) => docSet.has(t)).length;
      const denom = Math.max(Math.min(qSet.size, docSet.size), 1);
      const overlapScore = intersection / denom;
      // final score: 85% vector sim + 15% overlap score
      const finalScore = s.score * 0.85 + overlapScore * 0.15;
      const excerpt = doc.content ? doc.content.slice(0, 300) : '';
      return { doc_id: s.doc_id, score: finalScore, title: doc.title, content: doc.content, excerpt };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((s) => s.score > 0);

  // For each top document, extract top passages for provenance-aware prompts.
  function getTopPassages(content, qTokens, maxPassages = 2) {
    if (!content) return [];
    // Split into sentence-like passages (naive split on punctuation)
    const rawPassages = content
      .split(/(?<=[.!?])\s+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const scored = rawPassages.map((p, idx) => {
      const toks = tokenize(p);
      const overlap = toks.filter((t) => qTokens.has(t)).length;
      const score = overlap / Math.max(toks.length, 1);
      return { passage: p, score, idx };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxPassages).filter((s) => s.score > 0).map((s, i) => ({ id: i + 1, text: s.passage, score: s.score }));
  }

  const qTokens = new Set(tokens);
  const withPassages = enriched.map((d) => ({ ...d, passages: getTopPassages(d.content || '', qTokens, 2) }));
  return withPassages;
}
