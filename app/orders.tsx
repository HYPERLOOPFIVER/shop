
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase'; // Adjust path as needed

// Types
interface DeliveryAddress {
  city: string;
  pincode: string;
  state: string;
  street: string;
}

interface OrderItem {
  imageUrl: string;
  name: string;
  price: number;
  productId: string;
  quantity: number;
  shopId: string;
}

interface Order {
  id: string;
  cancelledAt?: Timestamp;
  createdAt: Timestamp;
  customerNotes?: string;
  deliveryAddress?: DeliveryAddress;
  deliveryFee?: number;
  items: OrderItem[];
  orderId: string;
  paymentMethod: 'cash' | 'online' | 'card';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  status: 'placed' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  total: number; // Changed from totalAmount to total to match Firestore field
  totalAmount: number;
  updatedAt: Timestamp;
  userEmail: string;
  userId: string;
}

interface UserData {
  name?: string;
  firstName?: string;
  displayName?: string;
  email?: string;
}

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [cashAmount, setCashAmount] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchUserData(currentUser.uid);
        fetchOrders(currentUser.uid);
      } else {
        setOrders([]);
        setUserData(null);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUserData(userDoc.data() as UserData);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Add the missing getUserDisplayName function
  const getUserDisplayName = () => {
    if (userData?.name) return userData.name;
    if (userData?.firstName) return userData.firstName;
    if (userData?.displayName) return userData.displayName;
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  };

  const fetchOrders = (userId: string) => {
    setLoading(true);
    
    const ordersQuery = query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData: Order[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Order data:', data); // Debug log
        
        // Parse delivery address properly
        let deliveryAddress = null;
        if (data.deliveryAddress) {
          if (Array.isArray(data.deliveryAddress) && data.deliveryAddress.length > 0) {
            // If deliveryAddress is an array, take the first element
            deliveryAddress = data.deliveryAddress[0];
          } else if (typeof data.deliveryAddress === 'object') {
            // If deliveryAddress is an object
            deliveryAddress = data.deliveryAddress;
          }
        }
        
        ordersData.push({
          id: doc.id,
          cancelledAt: data.cancelledAt,
          createdAt: data.createdAt,
          customerNotes: data.customerNotes || '',
          deliveryAddress: deliveryAddress ? {
            city: deliveryAddress.city || '',
            pincode: deliveryAddress.pincode || '',
            state: deliveryAddress.state || '',
            street: deliveryAddress.street || ''
          } : undefined,
          deliveryFee: Number(data.deliveryFee) || 0,
          items: data.items || [],
          orderId: data.orderId || '',
          paymentMethod: data.paymentMethod || 'cash',
          paymentStatus: data.paymentStatus || 'pending',
          status: data.status || 'placed',
          total: Number(data.total) || 0, // Fetch the actual total field from Firestore
          totalAmount: Number(data.totalAmount) || Number(data.total) || 0, // Fallback to total if totalAmount doesn't exist
          updatedAt: data.updatedAt,
          userEmail: data.userEmail || '',
          userId: data.userId || ''
        } as Order);
      });
      setOrders(ordersData);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error('Error fetching orders:', error);
      setLoading(false);
      setRefreshing(false);
      Alert.alert('Error', 'Failed to fetch orders. Please try again.');
    });

    return unsubscribe;
  };

  const onRefresh = () => {
    if (user) {
      setRefreshing(true);
      fetchOrders(user.uid);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      Alert.alert('Success', 'Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      Alert.alert('Error', 'Failed to cancel order. Please try again.');
    }
  };

  const confirmCashPayment = async (orderId: string, amount: number) => {
    if (!cashAmount || parseFloat(cashAmount) !== amount) {
      Alert.alert('Error', 'Please enter the correct cash amount');
      return;
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        updatedAt: serverTimestamp()
      });
      
      setPaymentModalVisible(false);
      setCashAmount('');
      Alert.alert('Success', 'Cash payment confirmed');
    } catch (error) {
      console.error('Error confirming payment:', error);
      Alert.alert('Error', 'Failed to confirm payment. Please try again.');
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'placed': return '#FF9500';
      case 'confirmed': return '#007AFF';
      case 'preparing': return '#FF9500';
      case 'out_for_delivery': return '#34C759';
      case 'delivered': return '#30D158';
      case 'cancelled': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#30D158';
      case 'pending': return '#FF9500';
      case 'failed': return '#FF3B30';
      case 'refunded': return '#007AFF';
      default: return '#8E8E93';
    }
  };

  const formatDate = (timestamp: Timestamp | null | undefined) => {
    if (!timestamp) return 'N/A';
    try {
      return timestamp.toDate().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const canCancelOrder = (order: Order) => {
    return ['placed', 'confirmed'].includes(order.status) && !order.cancelledAt;
  };

  const showCashPaymentOption = (order: Order) => {
    return order.paymentMethod === 'cash' && 
           order.paymentStatus === 'pending' && 
           order.status === 'delivered';
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity 
      style={styles.orderCard}
      onPress={() => {
        setSelectedOrder(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Order #{item.orderId}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>

      <View style={styles.itemsPreview}>
        {item.items && item.items.length > 0 ? (
          <>
            {item.items.slice(0, 2).map((product, index) => (
              <View key={index} style={styles.itemPreview}>
                <Image 
                  source={{ uri: product.imageUrl || 'https://via.placeholder.com/40' }} 
                  style={styles.itemImage} 
                  onError={() => console.log('Image load error')}
                />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {product.name || 'Unknown Product'}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ₹{product.price || 0} x {product.quantity || 0}
                  </Text>
                </View>
              </View>
            ))}
            {item.items.length > 2 && (
              <Text style={styles.moreItems}>+{item.items.length - 2} more items</Text>
            )}
          </>
        ) : (
          <Text style={styles.noItems}>No items found</Text>
        )}
      </View>

      <View style={styles.orderFooter}>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentMethod}>{item.paymentMethod.toUpperCase()}</Text>
          <View style={[styles.paymentStatusBadge, { backgroundColor: getPaymentStatusColor(item.paymentStatus) }]}>
            <Text style={styles.paymentStatusText}>{item.paymentStatus.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.totalAmount}>₹{item.total || item.totalAmount}</Text>
      </View>

      <View style={styles.actionButtons}>
        {canCancelOrder(item) && (
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => {
              Alert.alert(
                'Cancel Order',
                'Are you sure you want to cancel this order?',
                [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes', onPress: () => cancelOrder(item.id) }
                ]
              );
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel Order</Text>
          </TouchableOpacity>
        )}

        {showCashPaymentOption(item) && (
          <TouchableOpacity 
            style={styles.payButton}
            onPress={() => {
              setSelectedOrder(item);
              setPaymentModalVisible(true);
            }}
          >
            <Text style={styles.payButtonText}>Confirm Cash Payment</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your orders...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Please log in to view your orders</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Greeting Section */}
      <View style={styles.greetingSection}>
        <Text style={styles.greeting}>Hello, {getUserDisplayName()}! 👋</Text>
        <Text style={styles.subGreeting}>Here are your orders</Text>
      </View>
      
      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No orders found</Text>
          <Text style={styles.emptySubtext}>Start shopping to see your orders here!</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Order Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {selectedOrder && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Order Details</Text>
                    <TouchableOpacity 
                      onPress={() => setModalVisible(false)}
                      style={styles.closeButton}
                    >
                      <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.sectionTitle}>Order Information</Text>
                    <Text style={styles.detailText}>Order ID: {selectedOrder.orderId}</Text>
                    <Text style={styles.detailText}>Date: {formatDate(selectedOrder.createdAt)}</Text>
                    <Text style={styles.detailText}>Status: {selectedOrder.status.replace('_', ' ')}</Text>
                    <Text style={styles.detailText}>Payment: {selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})</Text>
                  </View>

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    {selectedOrder.deliveryAddress ? (
                      <>
                        <Text style={styles.detailText}>
                          {selectedOrder.deliveryAddress.street || 'Street not provided'}
                        </Text>
                        <Text style={styles.detailText}>
                          {selectedOrder.deliveryAddress.city || 'City not provided'}, {selectedOrder.deliveryAddress.state || 'State not provided'}
                        </Text>
                        <Text style={styles.detailText}>
                          Pincode: {selectedOrder.deliveryAddress.pincode || 'Not provided'}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.detailText}>Delivery address not available</Text>
                    )}
                  </View>

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.sectionTitle}>Items</Text>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item, index) => (
                        <View key={index} style={styles.modalItem}>
                          <Image 
                            source={{ uri: item.imageUrl || 'https://via.placeholder.com/50' }} 
                            style={styles.modalItemImage} 
                            onError={() => console.log('Modal image load error')}
                          />
                          <View style={styles.modalItemDetails}>
                            <Text style={styles.modalItemName}>{item.name || 'Unknown Product'}</Text>
                            <Text style={styles.modalItemPrice}>₹{item.price || 0} x {item.quantity || 0}</Text>
                            <Text style={styles.modalItemTotal}>₹{(item.price || 0) * (item.quantity || 0)}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.detailText}>No items found</Text>
                    )}
                  </View>

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.sectionTitle}>Payment Summary</Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Subtotal:</Text>
                      <Text style={styles.summaryValue}>₹{(selectedOrder.total || selectedOrder.totalAmount) - (selectedOrder.deliveryFee || 0)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Delivery Fee:</Text>
                      <Text style={styles.summaryValue}>₹{selectedOrder.deliveryFee || 0}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow]}>
                      <Text style={styles.totalLabel}>Total:</Text>
                      <Text style={styles.totalValue}>₹{selectedOrder.total || selectedOrder.totalAmount}</Text>
                    </View>
                  </View>

                  {selectedOrder.customerNotes && (
                    <View style={styles.orderDetailSection}>
                      <Text style={styles.sectionTitle}>Customer Notes</Text>
                      <Text style={styles.detailText}>{selectedOrder.customerNotes}</Text>
                    </View>
                  )}

                  {/* Modal Action Buttons */}
                  <View style={styles.modalActionButtons}>
                    {canCancelOrder(selectedOrder) && (
                      <TouchableOpacity 
                        style={styles.modalCancelButton}
                        onPress={() => {
                          Alert.alert(
                            'Cancel Order',
                            'Are you sure you want to cancel this order?',
                            [
                              { text: 'No', style: 'cancel' },
                              { 
                                text: 'Yes', 
                                onPress: () => {
                                  cancelOrder(selectedOrder.id);
                                  setModalVisible(false);
                                }
                              }
                            ]
                          );
                        }}
                      >
                        <Text style={styles.modalCancelButtonText}>Cancel Order</Text>
                      </TouchableOpacity>
                    )}

                    {showCashPaymentOption(selectedOrder) && (
                      <TouchableOpacity 
                        style={styles.modalPayButton}
                        onPress={() => {
                          setModalVisible(false);
                          setPaymentModalVisible(true);
                        }}
                      >
                        <Text style={styles.modalPayButtonText}>Confirm Cash Payment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cash Payment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={paymentModalVisible}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalContent}>
            <Text style={styles.paymentModalTitle}>Confirm Cash Payment</Text>
            
            {selectedOrder && (
              <>
                <Text style={styles.paymentAmount}>
                  Amount to Pay: ₹{selectedOrder.total || selectedOrder.totalAmount}
                </Text>
                
                <TextInput
                  style={styles.cashInput}
                  placeholder="Enter cash amount received"
                  value={cashAmount}
                  onChangeText={setCashAmount}
                  keyboardType="numeric"
                />
                
                <View style={styles.paymentButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.paymentCancelButton}
                    onPress={() => {
                      setPaymentModalVisible(false);
                      setCashAmount('');
                    }}
                  >
                    <Text style={styles.paymentCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.paymentConfirmButton}
                    onPress={() => confirmCashPayment(selectedOrder.id, selectedOrder.total || selectedOrder.totalAmount)}
                  >
                    <Text style={styles.paymentConfirmButtonText}>Confirm Payment</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  greetingSection: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  itemsPreview: {
    marginBottom: 12,
  },
  itemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  itemPrice: {
    fontSize: 12,
    color: '#666',
  },
  moreItems: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
  },
  noItems: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethod: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginRight: 8,
  },
  paymentStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  paymentStatusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  payButton: {
    backgroundColor: '#30D158',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  payButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  orderDetailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  modalItemDetails: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  modalItemPrice: {
    fontSize: 12,
    color: '#666',
  },
  modalItemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  paymentModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '85%',
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 20,
  },
  paymentAmount: {
    fontSize: 16,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 20,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  paymentButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    },
    paymentCancelButton: {
      flex: 1,
      backgroundColor: '#FF3B30',
      padding: 12,
      borderRadius: 8,
      marginRight: 8,
    },
    paymentCancelButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    paymentConfirmButton: {
      flex: 1,
      backgroundColor: '#30D158',
      padding: 12,
      borderRadius: 8,
      marginLeft: 8,
    },
    paymentConfirmButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  });

  export default Orders;