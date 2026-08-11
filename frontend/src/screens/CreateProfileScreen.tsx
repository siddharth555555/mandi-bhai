import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createRetailerProfile,
  createWholesalerProfile,
  listMandis,
  type Mandi,
} from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Role = 'retailer' | 'wholesaler';

export default function CreateProfileScreen() {
  const { token, updateSession } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [shopName, setShopName] = useState('');
  const [mandis, setMandis] = useState<Mandi[]>([]);
  const [mandiId, setMandiId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'wholesaler') {
      listMandis()
        .then(setMandis)
        .catch(() => setMandis([]));
    }
  }, [role]);

  const canSubmit =
    !!shopName.trim() && (role === 'retailer' || (role === 'wholesaler' && !!mandiId));

  const submit = async () => {
    if (!token || !role || !canSubmit || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { token: newToken } =
        role === 'retailer'
          ? await createRetailerProfile(token, shopName.trim())
          : await createWholesalerProfile(token, shopName.trim(), mandiId!);
      await updateSession(newToken);
      // App.tsx routes to the right home screen once `user.profiles` updates.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create profile');
    } finally {
      setLoading(false);
    }
  };

  if (!role) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Who are you?</Text>
        <Text style={styles.subtitle}>Set up your first profile to get started</Text>

        <TouchableOpacity style={styles.card} onPress={() => setRole('retailer')}>
          <Text style={styles.cardTitle}>Retailer</Text>
          <Text style={styles.cardSub}>Buy wholesale groceries for my shop</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => setRole('wholesaler')}>
          <Text style={styles.cardTitle}>Wholesaler</Text>
          <Text style={styles.cardSub}>Sell to retailers, manage inventory</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Mandi Admin accounts aren't self-serve yet — they're set up manually per mandi.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => setRole(null)} style={styles.back}>
        <Text style={{ fontSize: 18 }}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        {role === 'retailer' ? 'Set up your shop' : 'Set up your wholesale business'}
      </Text>

      <Text style={styles.label}>Shop / business name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Sharma Kirana Store"
        value={shopName}
        onChangeText={setShopName}
      />

      {role === 'wholesaler' && (
        <>
          <Text style={styles.label}>Which mandi are you part of?</Text>
          {mandis.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : (
            mandis.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.mandiRow, mandiId === m.id && styles.mandiRowActive]}
                onPress={() => setMandiId(m.id)}
              >
                <Text style={styles.mandiName}>{m.name}</Text>
                <Text style={styles.mandiCity}>{m.city}</Text>
              </TouchableOpacity>
            ))
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit || loading}
        onPress={submit}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#FBF7EF', padding: 24, paddingTop: 60 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F1ECE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#191723' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#6B6577', marginBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 19, fontWeight: '700' },
  cardSub: { marginTop: 4, color: '#6B6577' },
  note: { marginTop: 'auto', textAlign: 'center', color: '#A49EAF', fontSize: 12 },
  label: { marginTop: 18, marginBottom: 7, fontWeight: '800', fontSize: 13, color: '#4A4556' },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#EDE7DA',
    borderRadius: 13,
    paddingHorizontal: 14,
    fontWeight: '700',
    fontSize: 15,
    backgroundColor: '#fff',
  },
  mandiRow: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#EDE7DA',
    marginBottom: 10,
  },
  mandiRowActive: { borderColor: '#FF5436', backgroundColor: '#FFF3F0' },
  mandiName: { fontWeight: '800', fontSize: 15 },
  mandiCity: { color: '#6B6577', fontSize: 12, marginTop: 2 },
  error: { marginTop: 14, color: '#E23B1E', fontWeight: '600' },
  button: {
    marginTop: 26,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FF5436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
