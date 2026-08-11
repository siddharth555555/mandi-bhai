import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius } from '../../theme';

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.sub}>Track deliveries from your wholesalers</Text>
      </View>
      <ScrollView>
        <EmptyState
          icon="receipt-long"
          title="No orders yet"
          body="Your placed orders will appear here once ordering is built."
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: colors.onNavy, fontSize: 13, fontWeight: '700', marginTop: 2 },
});
