import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Packshot } from './Packshot';
import { Icon } from './Icon';
import { colors, radius, shadow } from '../theme';
import type { Product } from '../api/client';

type Props = {
  product: Product;
  onPress: () => void;
  /** Height of the packshot area — smaller inside the category grid. */
  imageHeight?: number;
};

export function ProductCard({ product, onPress, imageHeight = 112 }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.imageArea, { height: imageHeight }]}>
        <Packshot
          brand={product.brand ?? product.name}
          weight={product.pack.label}
          seed={product.id}
          brandFontSize={11}
        />
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
        <Text style={styles.pack}>{product.pack.label}</Text>

        <View style={styles.footer}>
          {product.offers.lowestPrice != null ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.fromLabel}>from</Text>
              <Text style={styles.price}>₹{product.offers.lowestPrice}</Text>
              <Text style={styles.sellers}>
                {product.offers.sellerCount}{' '}
                {product.offers.sellerCount === 1 ? 'seller' : 'sellers'}
              </Text>
            </View>
          ) : (
            <Text style={styles.noSellers}>No sellers yet</Text>
          )}
          <View style={styles.chevron}>
            <Icon name="chevron-right" size={18} color={colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  imageArea: {
    backgroundColor: colors.sunken,
    position: 'relative',
  },
  body: { padding: 10, paddingTop: 9 },
  name: {
    fontWeight: '800',
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.text,
    minHeight: 32,
  },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  pack: {
    marginTop: 2,
    fontWeight: '700',
    fontSize: 10.5,
    color: colors.textFaint,
  },
  fromLabel: { fontSize: 9.5, fontWeight: '700', color: colors.textGhost },
  price: { fontWeight: '800', fontSize: 16, color: colors.text, lineHeight: 19 },
  sellers: { fontSize: 10, fontWeight: '700', color: colors.green },
  noSellers: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textGhost,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
