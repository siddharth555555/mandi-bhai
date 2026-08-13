import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, shadow } from '../../theme';
import { cancelOrder, getOrder, type OrderDetail } from '../../api/client';
import { ORDER_STATUS_STYLE } from '../../orderStatus';
import { useAuth } from '../../auth/AuthContext';
import type { RetailerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RetailerStackParamList, 'OrderDetail'>;

const CANCELLABLE = new Set(['placed', 'confirmed']);

export default function OrderDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { orderId } = route.params;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setOrder(await getOrder(token, orderId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this order');
    } finally {
      setLoading(false);
    }
  }, [token, orderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onCancel = () => {
    Alert.alert('Cancel order?', 'This can\'t be undone.', [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setCancelling(true);
          try {
            setOrder(await cancelOrder(token, orderId));
          } catch (e) {
            Alert.alert('Could not cancel', e instanceof Error ? e.message : 'Try again');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{order?.orderNumber ?? 'Order'}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error || !order ? (
        <EmptyState icon="error-outline" title="Couldn't load this order" body={error ?? undefined} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View
              style={[
                styles.statusBanner,
                { backgroundColor: ORDER_STATUS_STYLE[order.status].bg },
              ]}
            >
              <Text
                style={[styles.statusText, { color: ORDER_STATUS_STYLE[order.status].fg }]}
              >
                {ORDER_STATUS_STYLE[order.status].label}
              </Text>
              {order.rejectReason ? (
                <Text style={styles.statusReason}>Reason: {order.rejectReason}</Text>
              ) : null}
              {order.cancelReason ? (
                <Text style={styles.statusReason}>Reason: {order.cancelReason}</Text>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>From</Text>
            <Text style={styles.plainText}>{order.wholesalerName ?? 'Wholesaler'}</Text>

            <Text style={styles.sectionTitle}>Deliver to</Text>
            <Text style={styles.plainText}>{order.deliveryAddress}</Text>

            <Text style={styles.sectionTitle}>Items</Text>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>
                    {item.packLabel} · {item.quantity} × ₹{item.pricePerUnit}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>₹{item.lineTotal}</Text>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{order.subtotal}</Text>
            </View>

            <Text style={styles.paymentLine}>
              {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Udhaar (credit)'} ·{' '}
              {order.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'}
            </Text>
          </ScrollView>

          {CANCELLABLE.has(order.status) ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={cancelling}
                onPress={onCancel}
              >
                {cancelling ? (
                  <ActivityIndicator color={colors.primaryDark} />
                ) : (
                  <Text style={styles.cancelText}>Cancel order</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, paddingBottom: 40 },
  statusBanner: { borderRadius: radius.lg, padding: 14, marginBottom: 8 },
  statusText: { fontWeight: '800', fontSize: 15 },
  statusReason: { marginTop: 4, fontWeight: '700', fontSize: 12, color: colors.textMuted },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '800',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  plainText: { fontWeight: '700', fontSize: 14, color: colors.text },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    ...shadow.card,
  },
  itemName: { fontWeight: '800', fontSize: 13.5, color: colors.text },
  itemMeta: { marginTop: 2, fontWeight: '700', fontSize: 11.5, color: colors.textFaint },
  itemTotal: { fontWeight: '800', fontSize: 14, color: colors.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 6,
    paddingTop: 12,
  },
  totalLabel: { fontWeight: '800', fontSize: 15, color: colors.text },
  totalValue: { fontWeight: '800', fontSize: 17, color: colors.text },
  paymentLine: { marginTop: 10, fontWeight: '700', fontSize: 12.5, color: colors.textMuted },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  cancelButton: {
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.primaryDark, fontWeight: '800', fontSize: 14 },
});
