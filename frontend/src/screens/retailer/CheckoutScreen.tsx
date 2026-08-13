import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, shadow } from '../../theme';
import {
  checkout,
  getCart,
  getMyWallet,
  type CartView,
  type PaymentMethod,
  type WalletView,
} from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { RetailerStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RetailerStackParamList>;

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { token, user } = useAuth();

  const [cart, setCart] = useState<CartView | null>(null);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cod');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = user?.profiles.retailer?.address ?? null;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [c, w] = await Promise.all([getCart(token), getMyWallet(token)]);
      setCart(c);
      setWallet(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load checkout details');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const place = async () => {
    if (!token || placing) return;
    setPlacing(true);
    setError(null);
    try {
      const orders = await checkout(token, method);
      navigation.replace('OrderDetail', { orderId: orders[0].id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place your order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionTitle}>Delivery address</Text>
          {address ? (
            <View style={styles.addressCard}>
              <Icon name="location-on" size={20} color={colors.primary} />
              <Text style={styles.addressText}>{address}</Text>
            </View>
          ) : (
            <View style={styles.addressMissing}>
              <Icon name="error-outline" size={20} color={colors.primaryDark} />
              <Text style={styles.addressMissingText}>
                Add your shop address from Profile before checking out — deliveries need
                somewhere to go.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Payment method</Text>
          <TouchableOpacity
            style={[styles.methodCard, method === 'cod' && styles.methodCardActive]}
            onPress={() => setMethod('cod')}
          >
            <Icon name="payments" size={22} color={colors.blue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>Cash on delivery</Text>
              <Text style={styles.methodSub}>Pay the rider when your order arrives</Text>
            </View>
            {method === 'cod' ? (
              <Icon name="check-circle" size={20} color={colors.primary} />
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodCard,
              method === 'udhaar' && styles.methodCardActive,
              (wallet?.creditLimit ?? 0) <= 0 && styles.methodCardDisabled,
            ]}
            disabled={(wallet?.creditLimit ?? 0) <= 0}
            onPress={() => setMethod('udhaar')}
          >
            <Icon name="account-balance-wallet" size={22} color={colors.blue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>Udhaar (credit)</Text>
              <Text style={styles.methodSub}>
                {wallet && wallet.creditLimit > 0
                  ? `Available ₹${wallet.available} of ₹${wallet.creditLimit}`
                  : 'Not enabled — ask your Mandi Admin to set a credit limit'}
              </Text>
            </View>
            {method === 'udhaar' ? (
              <Icon name="check-circle" size={20} color={colors.primary} />
            ) : null}
          </TouchableOpacity>

          {cart ? (
            <>
              <Text style={styles.sectionTitle}>Order summary</Text>
              {cart.wholesalerGroups.map((g) => (
                <View key={g.wholesalerProfileId} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{g.wholesalerName}</Text>
                  <Text style={styles.summaryValue}>₹{g.subtotal}</Text>
                </View>
              ))}
              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>₹{cart.subtotal}</Text>
              </View>
              <Text style={styles.splitHint}>
                {cart.wholesalerGroups.length > 1
                  ? `This will create ${cart.wholesalerGroups.length} separate orders, one per wholesaler.`
                  : 'This will create 1 order.'}
              </Text>
            </>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {!loading ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <TouchableOpacity
            style={[styles.placeButton, (!address || placing) && styles.placeButtonDisabled]}
            disabled={!address || placing}
            onPress={place}
          >
            {placing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.placeButtonText}>Place order</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.card,
  },
  addressText: { flex: 1, fontWeight: '700', fontSize: 13.5, color: colors.text },
  addressMissing: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: 14,
  },
  addressMissingText: { flex: 1, fontWeight: '700', fontSize: 12.5, color: colors.primaryDark },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  methodCardActive: { borderColor: colors.primary },
  methodCardDisabled: { opacity: 0.5 },
  methodTitle: { fontWeight: '800', fontSize: 14, color: colors.text },
  methodSub: { marginTop: 2, fontWeight: '700', fontSize: 11.5, color: colors.textFaint },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontWeight: '700', fontSize: 13, color: colors.textMuted },
  summaryValue: { fontWeight: '800', fontSize: 13, color: colors.text },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 10 },
  summaryTotalLabel: { fontWeight: '800', fontSize: 15, color: colors.text },
  summaryTotalValue: { fontWeight: '800', fontSize: 17, color: colors.text },
  splitHint: { marginTop: 10, fontWeight: '600', fontSize: 11.5, color: colors.textGhost },
  errorBox: {
    marginTop: 16,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 12,
  },
  errorText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12.5 },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  placeButton: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeButtonDisabled: { opacity: 0.5 },
  placeButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
