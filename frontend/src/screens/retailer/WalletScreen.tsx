import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, shadow } from '../../theme';
import { getMyWallet, type WalletView } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { RetailerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RetailerStackParamList, 'Wallet'>;

const TXN_LABEL: Record<string, string> = {
  draw: 'Order placed',
  repayment: 'Repayment',
  adjustment: 'Limit adjusted',
};

export default function WalletScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setWallet(await getMyWallet(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your wallet');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Udhaar wallet</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error || !wallet ? (
        <EmptyState icon="error-outline" title="Couldn't load your wallet" body={error ?? undefined} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Available</Text>
                <Text style={styles.summaryValueBig}>₹{wallet.available}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>Credit limit</Text>
                <Text style={styles.summaryValue}>₹{wallet.creditLimit}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.outstandingLabel}>Outstanding</Text>
            <Text style={styles.outstandingValue}>₹{wallet.outstandingBalance}</Text>
          </View>

          {wallet.creditLimit <= 0 ? (
            <View style={styles.notice}>
              <Icon name="info-outline" size={18} color={colors.blue} />
              <Text style={styles.noticeText}>
                Udhaar isn't enabled on your account yet — ask your Mandi Admin to set a
                credit limit.
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Recent activity</Text>
          {wallet.transactions.length === 0 ? (
            <Text style={styles.emptyText}>No Udhaar activity yet.</Text>
          ) : (
            wallet.transactions.map((t) => (
              <View key={t.id} style={styles.txnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>{TXN_LABEL[t.type] ?? t.type}</Text>
                  {t.note ? <Text style={styles.txnNote}>{t.note}</Text> : null}
                </View>
                <Text
                  style={[
                    styles.txnAmount,
                    { color: t.type === 'draw' ? colors.primaryDark : colors.greenDark },
                  ]}
                >
                  {t.type === 'draw' ? '+' : '-'}₹{t.amount}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: 18,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.onNavy, fontWeight: '700', fontSize: 11.5 },
  summaryValueBig: { color: '#fff', fontWeight: '800', fontSize: 26, marginTop: 2 },
  summaryValue: { color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 14 },
  outstandingLabel: { color: colors.onNavy, fontWeight: '700', fontSize: 11.5 },
  outstandingValue: { color: '#fff', fontWeight: '800', fontSize: 18, marginTop: 2 },
  notice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 14,
  },
  noticeText: { flex: 1, fontWeight: '700', fontSize: 12, color: '#223A80' },
  sectionTitle: { marginTop: 22, marginBottom: 10, fontWeight: '800', fontSize: 15, color: colors.text },
  emptyText: { fontWeight: '700', fontSize: 12.5, color: colors.textFaint },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    ...shadow.card,
  },
  txnTitle: { fontWeight: '800', fontSize: 13, color: colors.text },
  txnNote: { marginTop: 2, fontWeight: '700', fontSize: 11, color: colors.textFaint },
  txnAmount: { fontWeight: '800', fontSize: 14 },
});
