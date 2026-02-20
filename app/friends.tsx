import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  UserPlus,
  Search,
  Users,
  Check,
  X,
  Smartphone,
  Link,
} from 'lucide-react-native';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  respondToRequest,
  lookupByPhones,
  lookupByInviteCode,
} from '../services/friends';
import { useAuth } from '../context/AuthContext';
import { Friend, FriendRequest } from '../types';
import Colors from '../constants/colors';

type Tab = 'friends' | 'requests' | 'add';

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('friends');
  const [inviteCode, setInviteCode] = useState('');
  const [codeResult, setCodeResult] = useState<{ id: string; name: string; avatarUri?: string } | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [contactMatches, setContactMatches] = useState<{ id: string; name: string; phone?: string; avatarUri?: string }[]>([]);

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: getFriends,
  });

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['friendRequests'],
    queryFn: getFriendRequests,
  });

  const addMutation = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      Alert.alert('Request Sent', 'Your friend request has been sent!');
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) =>
      respondToRequest(id, action),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const handleScanContacts = useCallback(async () => {
    setScanLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Contacts permission is needed to find friends.');
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      const phones: string[] = [];
      for (const contact of data) {
        for (const p of contact.phoneNumbers ?? []) {
          const normalized = normalizePhone(p.number ?? '');
          if (normalized) phones.push(normalized);
        }
      }

      const unique = [...new Set(phones)];
      if (unique.length === 0) {
        Alert.alert('No Contacts', 'No phone numbers found in your contacts.');
        return;
      }

      const matches = await lookupByPhones(unique);
      const filtered = matches.filter(m => m.id !== user?.id);
      setContactMatches(filtered);

      if (filtered.length === 0) {
        Alert.alert('No Matches', 'None of your contacts are on Chewabl yet. Invite them with your link!');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to scan contacts.');
      console.error(err);
    } finally {
      setScanLoading(false);
    }
  }, [user?.id]);

  const handleInviteLink = useCallback(async () => {
    if (!user?.inviteCode) return;
    await Share.share({
      message: `Join me on Chewabl! Use my invite code: ${user.inviteCode}\n\nDownload the app and enter the code when signing up.`,
    });
  }, [user?.inviteCode]);

  const handleLookupCode = useCallback(async () => {
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a valid invite code.');
      return;
    }
    setCodeLoading(true);
    try {
      const result = await lookupByInviteCode(code);
      if (!result || result.id === user?.id) {
        Alert.alert('Not Found', 'No user found with that invite code.');
        setCodeResult(null);
      } else {
        setCodeResult(result);
      }
    } finally {
      setCodeLoading(false);
    }
  }, [inviteCode, user?.id]);

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.personRow}>
      {item.avatarUri ? (
        <Image source={{ uri: item.avatarUri }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{item.name[0]?.toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.personName}>{item.name}</Text>
      {item.phone && <Text style={styles.personSub}>{item.phone}</Text>}
    </View>
  );

  const renderRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.personRow}>
      {item.from.avatarUri ? (
        <Image source={{ uri: item.from.avatarUri }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{item.from.name[0]?.toUpperCase()}</Text>
        </View>
      )}
      <Text style={[styles.personName, { flex: 1 }]}>{item.from.name}</Text>
      <Pressable
        style={[styles.respondBtn, styles.respondBtnAccept]}
        onPress={() => respondMutation.mutate({ id: item.id, action: 'accept' })}
      >
        <Check size={16} color="#FFF" />
      </Pressable>
      <Pressable
        style={[styles.respondBtn, styles.respondBtnDecline]}
        onPress={() => respondMutation.mutate({ id: item.id, action: 'decline' })}
      >
        <X size={16} color={Colors.error} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabRow}>
        {(['friends', 'requests', 'add'] as Tab[]).map(t => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'friends' ? `Friends${friends.length > 0 ? ` (${friends.length})` : ''}`
                : t === 'requests' ? `Requests${requests.length > 0 ? ` (${requests.length})` : ''}`
                : 'Add'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'friends' && (
        <FlatList
          data={friends}
          keyExtractor={item => item.id}
          renderItem={renderFriend}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            friendsLoading ? (
              <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : (
              <View style={styles.emptyState}>
                <Users size={40} color={Colors.border} />
                <Text style={styles.emptyText}>No friends yet</Text>
                <Text style={styles.emptySub}>Add friends to start group swiping</Text>
              </View>
            )
          }
        />
      )}

      {tab === 'requests' && (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            requestsLoading ? (
              <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : (
              <View style={styles.emptyState}>
                <UserPlus size={40} color={Colors.border} />
                <Text style={styles.emptyText}>No pending requests</Text>
              </View>
            )
          }
        />
      )}

      {tab === 'add' && (
        <FlatList
          data={contactMatches}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={(
            <View>
              <Pressable style={styles.actionCard} onPress={handleScanContacts} disabled={scanLoading}>
                {scanLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Smartphone size={22} color={Colors.primary} />
                )}
                <View style={styles.actionCardContent}>
                  <Text style={styles.actionCardTitle}>Scan Contacts</Text>
                  <Text style={styles.actionCardSub}>Find friends already on Chewabl</Text>
                </View>
              </Pressable>

              <Pressable style={styles.actionCard} onPress={handleInviteLink}>
                <Link size={22} color={Colors.secondary} />
                <View style={styles.actionCardContent}>
                  <Text style={styles.actionCardTitle}>Invite by Link</Text>
                  <Text style={styles.actionCardSub}>
                    Your code: {user?.inviteCode ?? '—'}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.codeSection}>
                <Text style={styles.codeSectionTitle}>Enter Invite Code</Text>
                <View style={styles.codeRow}>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="e.g. AB3K9X2M"
                    placeholderTextColor={Colors.textTertiary}
                    value={inviteCode}
                    onChangeText={t => setInviteCode(t.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={8}
                  />
                  <Pressable style={styles.codeBtn} onPress={handleLookupCode} disabled={codeLoading}>
                    {codeLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Search size={18} color="#FFF" />
                    )}
                  </Pressable>
                </View>

                {codeResult && (
                  <View style={styles.personRow}>
                    {codeResult.avatarUri ? (
                      <Image source={{ uri: codeResult.avatarUri }} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitial}>{codeResult.name[0]?.toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={[styles.personName, { flex: 1 }]}>{codeResult.name}</Text>
                    <Pressable
                      style={styles.addBtn}
                      onPress={() => {
                        addMutation.mutate(codeResult.id);
                        setCodeResult(null);
                        setInviteCode('');
                      }}
                    >
                      <UserPlus size={16} color="#FFF" />
                      <Text style={styles.addBtnText}>Add</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {contactMatches.length > 0 && (
                <Text style={styles.matchesHeader}>Contacts on Chewabl</Text>
              )}
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.personRow}>
              {item.avatarUri ? (
                <Image source={{ uri: item.avatarUri }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{item.name[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{item.name}</Text>
                {item.phone && <Text style={styles.personSub}>{item.phone}</Text>}
              </View>
              <Pressable
                style={styles.addBtn}
                onPress={() => {
                  addMutation.mutate(item.id);
                  setContactMatches(prev => prev.filter(m => m.id !== item.id));
                }}
              >
                <UserPlus size={16} color="#FFF" />
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  personSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  respondBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  respondBtnAccept: {
    backgroundColor: Colors.success,
  },
  respondBtnDecline: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  actionCardSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  codeSection: {
    marginBottom: 20,
  },
  codeSectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    letterSpacing: 2,
  },
  codeBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchesHeader: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
