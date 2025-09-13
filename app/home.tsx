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
  Dimensions,
  Linking,
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
import { router } from 'expo-router';
const { width } = Dimensions.get('window');

// Types
interface DeliveryAddress {
  city: string;
  pincode: string;
  state?: string;
  street?: string;
  formatted?: string;
  landmark?: string;
  area?: string;
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
  total: number;
  totalAmount: number;
  updatedAt: Timestamp;
  userEmail: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
}

interface ShopData {
  name?: string;
  shopName?: string;
  ownerName?: string;
  email?: string;
}

const ShopkeeperDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [todayOrders, setTodayOrders] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);

  const statusOptions = [
    { key: 'all', label: 'All Orders', color: '#8E8E93' },
    { key: 'placed', label: 'New Orders', color: '#FF9500' },
    { key: 'confirmed', label: 'Confirmed', color: '#007AFF' },
    { key: 'preparing', label: 'Preparing', color: '#FF9500' },
    { key: 'out_for_delivery', label: 'Out for Delivery', color: '#34C759' },
    { key: 'delivered', label: 'Delivered', color: '#30D158' },
    { key: 'cancelled', label: 'Cancelled', color: '#FF3B30' },
  ];

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchShopData(currentUser.uid);
        fetchOrders(currentUser.uid);
      } else {
        setOrders([]);
        setShopData(null);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    filterOrders();
    calculateStats();
  }, [orders, statusFilter, searchQuery]);

  const fetchShopData = async (userId: string) => {
    try {
      const shopDoc = await getDoc(doc(db, 'shops', userId));
      if (shopDoc.exists()) {
        setShopData(shopDoc.data() as ShopData);
      }
    } catch (error) {
      console.error('Error fetching shop data:', error);
    }
  };

  const getShopDisplayName = () => {
    if (shopData?.shopName) return shopData.shopName;
    if (shopData?.name) return shopData.name;
    if (shopData?.ownerName) return shopData.ownerName;
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'Shop';
  };

  const fetchOrders = (shopOwnerId: string) => {
    setLoading(true);
    
    // Query orders where any item belongs to this shop
    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, async (snapshot) => {
      const ordersData: Order[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        
        // Check if any item in the order belongs to this shop
        const hasShopItems = data.items?.some((item: OrderItem) => item.shopId === shopOwnerId);
        
        if (hasShopItems) {
          // Fetch customer data
          let customerName = 'Unknown Customer';
          let customerPhone = '';
          
          try {
            if (data.userId) {
              const customerDoc = await getDoc(doc(db, 'users', data.userId));
              if (customerDoc.exists()) {
                const customerData = customerDoc.data();
                customerName = customerData.name || customerData.firstName || customerData.displayName || 'Unknown Customer';
                // Fetch phone number properly
                customerPhone = customerData.phone || customerData.phoneNumber || customerData.mobile || '';
              }
            }
          } catch (error) {
            console.error('Error fetching customer data:', error);
          }
let deliveryAddress = null;

const addressSource = data.address;

if (addressSource && typeof addressSource === 'object') {
  const addressData = Array.isArray(addressSource) && addressSource.length > 0
    ? addressSource[0]
    : addressSource;

  if (addressData && typeof addressData === 'object') {
    deliveryAddress = {
      city: addressData.city || '',
      pincode: addressData.pincode || '',
      state: addressData.state || '',
      street: addressData.street || '',
      formatted: addressData.formatted || '',
      landmark: addressData.landmark || '',
      area: addressData.area || ''
    };
  }
}


          // Filter items to only include this shop's items
          const shopItems = data.items?.filter((item: OrderItem) => item.shopId === shopOwnerId) || [];
          
          // Calculate total for this shop's items only
          const shopTotal = shopItems.reduce((sum: number, item: OrderItem) => 
            sum + ((item.price || 0) * (item.quantity || 0)), 0
          );

          ordersData.push({
            id: docSnapshot.id,
            cancelledAt: data.cancelledAt,
            createdAt: data.createdAt,
            customerNotes: data.customerNotes || '',
            deliveryAddress: deliveryAddress,
            deliveryFee: Number(data.deliveryFee) || 0,
            items: shopItems, // Only this shop's items
            orderId: data.orderId || '',
            paymentMethod: data.paymentMethod || 'cash',
            paymentStatus: data.paymentStatus || 'pending',
            status: data.status || 'placed',
            total: shopTotal, // Shop-specific total
            totalAmount: shopTotal,
            updatedAt: data.updatedAt,
            userEmail: data.userEmail || '',
            userId: data.userId || '',
            customerName: customerName,
            customerPhone: customerPhone
          } as Order);
        }
      }
      
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

  const filterOrders = () => {
    let filtered = orders;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.orderId.toLowerCase().includes(query) ||
        order.customerName?.toLowerCase().includes(query) ||
        order.userEmail.toLowerCase().includes(query) ||
        order.customerPhone.toLowerCase().includes(query) ||
        order.items.some(item => item.name.toLowerCase().includes(query))
      );
    }

    setFilteredOrders(filtered);
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrdersList = orders.filter(order => {
      const orderDate = order.createdAt?.toDate();
      return orderDate && orderDate >= today;
    });

    const todayRev = todayOrdersList
      .filter(order => order.status !== 'cancelled')
      .reduce((sum, order) => sum + (order.total || 0), 0);

    const pending = orders.filter(order => 
      ['placed', 'confirmed', 'preparing'].includes(order.status)
    ).length;

    setTodayOrders(todayOrdersList.length);
    setTodayRevenue(todayRev);
    setPendingOrders(pending);
  };

  const onRefresh = () => {
    if (user) {
      setRefreshing(true);
      fetchOrders(user.uid);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      // If cancelling, add cancelled timestamp
      if (newStatus === 'cancelled') {
        updateData.cancelledAt = serverTimestamp();
      }

      await updateDoc(orderRef, updateData);
      
      Alert.alert('Success', `Order status updated to ${newStatus.replace('_', ' ')}`);
      setModalVisible(false);
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status. Please try again.');
    }
  };

 const navigateToAddPage = () => {
  router.push('/add'); // Or whatever your route is
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

  const getNextStatus = (currentStatus: string) => {
    const statusFlow = {
      'placed': 'confirmed',
      'confirmed': 'preparing',
      'preparing': 'out_for_delivery',
      'out_for_delivery': 'delivered'
    };
    return statusFlow[currentStatus as keyof typeof statusFlow];
  };

  const canUpdateStatus = (order: Order) => {
    return !['delivered', 'cancelled'].includes(order.status);
  };

  const canCancelOrder = (order: Order) => {
    return ['placed', 'confirmed'].includes(order.status);
  };

  const formatDeliveryAddress = (address: DeliveryAddress | undefined) => {
    if (!address) return 'Delivery address not available';
    
    // Use formatted address if available
    if (address.formatted) {
      return address.formatted;
    }
    
    // Build address from components
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.area) parts.push(address.area);
    if (address.landmark) parts.push(`Near ${address.landmark}`);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    
    return parts.length > 0 ? parts.join(', ') : 'Address details not available';
  };

  const renderStatusFilter = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.statusFilterContainer}
    >
      {statusOptions.map((option) => (
        <TouchableOpacity
          key={option.key}
          style={[
            styles.statusFilterButton,
            statusFilter === option.key && { backgroundColor: option.color }
          ]}
          onPress={() => setStatusFilter(option.key)}
        >
          <Text style={[
            styles.statusFilterText,
            statusFilter === option.key && { color: 'white' }
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderStatsCards = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{todayOrders}</Text>
        <Text style={styles.statLabel}>Today's Orders</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{formatCurrency(todayRevenue)}</Text>
        <Text style={styles.statLabel}>Today's Revenue</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{pendingOrders}</Text>
        <Text style={styles.statLabel}>Pending Orders</Text>
      </View>
    </View>
  );

  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity 
      style={styles.orderCard}
      onPress={() => {
        setSelectedOrder(item);
        setModalVisible(true);
            }}
          >
            <TouchableOpacity
        style={styles.shareButton}
        onPress={() => {
            const message = `Order Details:\n\nOrder ID: ${item.orderId}\nCustomer: ${item.customerName}\nPhone: ${item.customerPhone}\nAddress: ${formatDeliveryAddress(item.deliveryAddress)}\n\nItems:\n${item.items
            .map(
              (product) =>
            `- ${product.name} (₹${product.price} x ${product.quantity})`
            )
            .join('\n')}\n\nTotal: ₹${item.total}`;

           
          const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
          Linking.openURL(url).catch((err) =>
            console.error('Error opening WhatsApp:', err)
          );
        }}
            >
        <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderId}>#{item.orderId}</Text>
          <Text style={styles.customerName}>{item.customerName}</Text>
          {item.customerPhone && (
            <Text style={styles.customerPhone}>📞 {item.customerPhone}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>

      {/* Delivery Address Preview */}
      {item.deliveryAddress && (
        <View style={styles.addressPreview}>
          <Text style={styles.addressIcon}>📍</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {formatDeliveryAddress(item.deliveryAddress)}
          </Text>
        </View>
      )}

      <View style={styles.itemsPreview}>
        {item.items && item.items.length > 0 ? (
          <>
            {item.items.slice(0, 2).map((product, index) => (
              <View key={index} style={styles.itemPreview}>
                <Image 
                  source={{ uri: product.imageUrl || 'https://via.placeholder.com/40' }} 
                  style={styles.itemImage} 
                />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ₹{product.price} x {product.quantity}
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
        <Text style={styles.totalAmount}>₹{item.total}</Text>
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.quickActions}>
        {canUpdateStatus(item) && getNextStatus(item.status) && (
          <TouchableOpacity 
            style={[styles.quickActionButton, { backgroundColor: getStatusColor(getNextStatus(item.status)!) }]}
            onPress={() => updateOrderStatus(item.id, getNextStatus(item.status)!)}
          >
            <Text style={styles.quickActionText}>
              Mark as {getNextStatus(item.status)?.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        )}
        
        {canCancelOrder(item) && (
          <TouchableOpacity 
            style={[styles.quickActionButton, styles.cancelQuickAction]}
            onPress={() => {
              Alert.alert(
                'Cancel Order',
                'Are you sure you want to cancel this order?',
                [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes', onPress: () => updateOrderStatus(item.id, 'cancelled') }
                ]
              );
            }}
          >
            <Text style={styles.cancelQuickActionText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderAddButton = () => (
    <TouchableOpacity 
      style={styles.addButton}
      onPress={navigateToAddPage}
    >
      <Text style={styles.addButtonText}>+ Add Product</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Please log in to view orders</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>📊 {getShopDisplayName()}</Text>
            <Text style={styles.subGreeting}>Manage your orders</Text>
          </View>
          {renderAddButton()}
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/detai')}
          >
            <Text style={styles.addButtonText}>Manage Orders</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Stats Cards */}
      {renderStatsCards()}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search orders, customers, phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Status Filter */}
      {renderStatusFilter()}
      
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No orders found</Text>
          <Text style={styles.emptySubtext}>
            {statusFilter !== 'all' ? `No ${statusFilter} orders` : 'No orders available'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
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
                    <Text style={styles.modalTitle}>Order Management</Text>
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
                    <Text style={styles.detailText}>Customer: {selectedOrder.customerName}</Text>
                    <Text style={styles.detailText}>Email: {selectedOrder.userEmail}</Text>
                    {selectedOrder.customerPhone && (
                      <TouchableOpacity onPress={() => Alert.alert('Phone', selectedOrder.customerPhone)}>
                        <Text style={[styles.detailText, styles.phoneLink]}>
                          📞 Phone: {selectedOrder.customerPhone}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <Text style={styles.detailText}>Payment: {selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})</Text>
                  </View>

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    <Text style={styles.detailText}>
                      {formatDeliveryAddress(selectedOrder.deliveryAddress)}
                    </Text>
                    {selectedOrder.deliveryAddress?.pincode && (
                      <Text style={styles.detailText}>
                        📍 Pincode: {selectedOrder.deliveryAddress.pincode}
                      </Text>
                    )}
                  </View>

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.sectionTitle}>Items</Text>
                    {selectedOrder.items.map((item, index) => (
                      <View key={index} style={styles.modalItem}>
                        <Image 
                          source={{ uri: item.imageUrl || 'https://via.placeholder.com/50' }} 
                          style={styles.modalItemImage} 
                        />
                        <View style={styles.modalItemDetails}>
                          <Text style={styles.modalItemName}>{item.name}</Text>
                          <Text style={styles.modalItemPrice}>₹{item.price} x {item.quantity}</Text>
                          <Text style={styles.modalItemTotal}>₹{item.price * item.quantity}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={styles.orderDetailSection}>
                    <Text style={styles.sectionTitle}>Payment Summary</Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Items Total:</Text>
                      <Text style={styles.summaryValue}>₹{selectedOrder.total}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Delivery Fee:</Text>
                      <Text style={styles.summaryValue}>₹{selectedOrder.deliveryFee || 0}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow]}>
                      <Text style={styles.totalLabel}>Shop Total:</Text>
                      <Text style={styles.totalValue}>₹{selectedOrder.total}</Text>
                    </View>
                  </View>

                  {selectedOrder.customerNotes && (
                    <View style={styles.orderDetailSection}>
                      <Text style={styles.sectionTitle}>Customer Notes</Text>
                      <Text style={styles.detailText}>{selectedOrder.customerNotes}</Text>
                    </View>
                  )}

                  {/* Status Update Buttons */}
                  <View style={styles.statusUpdateSection}>
                    <Text style={styles.sectionTitle}>Update Order Status</Text>
                    <View style={styles.statusButtons}>
                      {statusOptions.slice(1).map((status) => (
                        <TouchableOpacity
                          key={status.key}
                          style={[
                            styles.statusButton,
                            { backgroundColor: status.color },
                            selectedOrder.status === status.key && styles.currentStatusButton
                          ]}
                          onPress={() => {
                            if (status.key !== selectedOrder.status) {
                              if (status.key === 'cancelled') {
                                Alert.alert(
                                  'Cancel Order',
                                  'Are you sure you want to cancel this order?',
                                  [
                                    { text: 'No', style: 'cancel' },
                                    { text: 'Yes', onPress: () => updateOrderStatus(selectedOrder.id, status.key) }
                                  ]
                                );
                              } else {
                                updateOrderStatus(selectedOrder.id, status.key);
                              }
                            }
                          }}
                          disabled={selectedOrder.status === status.key || 
                                   (selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled')}
                        >
                          <Text style={[
                            styles.statusButtonText,
                            selectedOrder.status === status.key && styles.currentStatusButtonText
                          ]}>
                            {status.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
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
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subGreeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  addButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    marginTop: -10,
    marginHorizontal: 20,
    borderRadius: 10,
    elevation: 2,
  
  
    shadowColor: '#000',  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusFilterContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  statusFilterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusFilterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  itemsPreview: {
    marginBottom: 15,
  },
  itemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  itemPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  moreItems: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 5,
  },
  noItems: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  paymentStatusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cancelQuickAction: {
    backgroundColor: '#FF3B30',
  },
  cancelQuickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
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
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: width * 0.9,
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  orderDetailSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
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
    color: '#333',
    marginBottom: 4,
  },
  modalItemPrice: {
    fontSize: 12,
    color: '#666',
  },
  modalItemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statusUpdateSection: {
    padding: 20,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  statusButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  currentStatusButton: {
    opacity: 0.5,
  },
  currentStatusButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default ShopkeeperDashboard;