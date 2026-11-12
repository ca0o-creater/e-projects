export const puppetLook = {
  glow: { color: 0xffd58a, distance: 6, outerStrength: 1, innerStrength: 0, quality: 0.2 },
  rivet: { radius: 7, color: '#4e301b', metal: '#bd8c43', highlight: '#ffe3a3' },
  rods: { color: '#563820', highlight: '#a27c45', width: 4, bottomY: 1110,
    houyi: { torso: { x: 0, y: -205 }, bodyFootX: 660, handFootX: 930 },
    queen: { torso: { x: 0, y: 55 }, bodyFootX: 1340, handFootX: 1120 } },
} as const;
