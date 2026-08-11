import { StyleSheet, Text, View } from 'react-native';

/**
 * Port of the prototype's Packshot component. There are no real product
 * photos yet, so every product renders as a stylised pack: a coloured carton
 * with the brand on the face and the pack size on a label strip.
 *
 * The colour is derived from the product's own text, so a given product
 * always renders the same shade without the backend storing one.
 */
const PACK_COLORS = [
  '#C8102E',
  '#1D4E89',
  '#0E8A5A',
  '#E8930B',
  '#7B2D8E',
  '#C2410C',
  '#0E9AA7',
  '#B91C4A',
  '#2456E6',
  '#4D7C0F',
];

export function packColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PACK_COLORS[hash % PACK_COLORS.length];
}

type Props = {
  /** Shown on the pack face — brand if known, else the product name. */
  brand: string;
  /** Shown on the label strip, e.g. "5 kg". */
  weight: string;
  /** Anything stable and unique; drives the colour. */
  seed?: string;
  brandFontSize?: number;
  /**
   * For small thumbnails: fills more of the tile and drops the weight strip,
   * since at that size both the brand and the weight ellipsize into noise
   * (and the surrounding row already shows them as text).
   */
  compact?: boolean;
};

export function Packshot({
  brand,
  weight,
  seed,
  brandFontSize = 12,
  compact = false,
}: Props) {
  const color = packColorFor(seed ?? brand);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.pack,
          compact && styles.packCompact,
          { backgroundColor: color },
        ]}
      >
        {/* darkened cap across the top of the carton */}
        <View style={styles.cap} />
        {/* soft highlight down the left face */}
        <View style={styles.highlight} />

        <View style={styles.faceArea}>
          <Text
            numberOfLines={compact ? 2 : 3}
            style={[
              styles.brand,
              { fontSize: brandFontSize, lineHeight: brandFontSize + 2 },
            ]}
          >
            {brand}
          </Text>
        </View>

        {!compact ? (
          <View style={styles.labelStrip}>
            <Text numberOfLines={1} style={styles.weight}>
              {weight}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pack: {
    width: '62%',
    maxWidth: 132,
    height: '82%',
    maxHeight: 150,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 7,
    paddingHorizontal: 6,
    overflow: 'hidden',
    shadowColor: '#140F28',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  packCompact: {
    width: '84%',
    height: '88%',
    paddingHorizontal: 3,
    paddingBottom: 4,
  },
  cap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '13%',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '12%',
    width: '14%',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  faceArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  labelStrip: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  weight: {
    color: '#23202B',
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0.2,
  },
});
