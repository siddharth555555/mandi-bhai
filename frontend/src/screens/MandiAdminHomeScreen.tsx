import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { colors, radius, shadow } from '../theme';
import { useAuth } from '../auth/AuthContext';

/**
 * Placeholder home for the Mandi Admin role. Previously these users logged in
 * and landed on nothing, because the navigator only handled retailer and
 * wholesaler profiles. Moderation and KYC review screens land here in the
 * later phases of PLAN-products-kyc.md.
 */
export default function MandiAdminHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const upcoming = [
    { icon: 'inventory-2', label: 'SKU moderation queue', sub: 'Approve, merge or reject submissions' },
    { icon: 'sell', label: 'Master catalogue', sub: 'Manage products and alternative names' },
    { icon: 'verified', label: 'KYC review', sub: 'Verify shops and wholesalers' },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Mandi Admin</Text>
        <Text style={styles.sub}>+91 {user?.phone}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.notice}>
          <Icon name="info-outline" size={20} color={colors.blue} />
          <Text style={styles.noticeText}>
            The catalogue API is live and admin-guarded, but these screens
            haven't been built yet. For now these actions are available over the
            API only.
          </Text>
        </View>

        {upcoming.map((row) => (
          <View key={row.label} style={styles.card}>
            <View style={styles.cardIcon}>
              <Icon name={row.icon} size={22} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{row.label}</Text>
              <Text style={styles.cardSub}>{row.sub}</Text>
            </View>
            <View style={styles.soonChip}>
              <Text style={styles.soonText}>SOON</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: colors.onNavy, fontSize: 13, fontWeight: '700', marginTop: 2 },
  notice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.blueSoft,
    borderWidth: 1,
    borderColor: '#C7D5F7',
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
    color: '#223A80',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { fontWeight: '800', fontSize: 14.5, color: colors.text },
  cardSub: { fontWeight: '700', fontSize: 12, color: colors.textFaint, marginTop: 2 },
  soonChip: {
    backgroundColor: colors.sunken,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  soonText: { fontWeight: '800', fontSize: 10, color: colors.textFaint },
  signOut: { marginTop: 20, alignItems: 'center', padding: 14 },
  signOutText: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
});
