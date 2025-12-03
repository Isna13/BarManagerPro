import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'dart:async';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;
  String? _fcmToken;

  // Callbacks
  Function(Map<String, dynamic>)? onMessageReceived;
  Function(String)? onTokenRefresh;

  Future<void> initialize() async {
    if (_initialized) return;

    try {
      // Request permissions
      NotificationSettings settings =
          await _firebaseMessaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      if (settings.authorizationStatus != AuthorizationStatus.authorized) {
        if (kDebugMode) debugPrint('⚠️ Notification permissions not granted');
        return;
      }

      // Initialize local notifications
      const AndroidInitializationSettings initializationSettingsAndroid =
          AndroidInitializationSettings('@mipmap/ic_launcher');

      const InitializationSettings initializationSettings =
          InitializationSettings(
        android: initializationSettingsAndroid,
        iOS: DarwinInitializationSettings(),
      );

      await _localNotifications.initialize(
        initializationSettings,
        onDidReceiveNotificationResponse: _onNotificationTapped,
      );

      // Create notification channels (Android)
      await _createNotificationChannels();

      // Get FCM token
      _fcmToken = await _firebaseMessaging.getToken();
      if (kDebugMode) debugPrint('✅ FCM Token: $_fcmToken');
      onTokenRefresh?.call(_fcmToken!);

      // Listen to token refresh
      _firebaseMessaging.onTokenRefresh.listen((newToken) {
        _fcmToken = newToken;
        if (kDebugMode) debugPrint('🔄 FCM Token refreshed: $newToken');
        onTokenRefresh?.call(newToken);
      });

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // Handle background messages
      FirebaseMessaging.onMessageOpenedApp.listen(_handleBackgroundMessage);

      // Handle notification taps when app is terminated
      RemoteMessage? initialMessage =
          await _firebaseMessaging.getInitialMessage();
      if (initialMessage != null) {
        _handleBackgroundMessage(initialMessage);
      }

      _initialized = true;
      if (kDebugMode) debugPrint('✅ Notification Service initialized');
    } catch (e) {
      if (kDebugMode)
        debugPrint('❌ Error initializing Notification Service: $e');
    }
  }

  Future<void> _createNotificationChannels() async {
    const AndroidNotificationChannel salesChannel = AndroidNotificationChannel(
      'sales_channel',
      'Vendas',
      description: 'Notificações de vendas e transações',
      importance: Importance.high,
      playSound: true,
    );

    const AndroidNotificationChannel cashChannel = AndroidNotificationChannel(
      'cash_channel',
      'Caixa',
      description: 'Notificações de abertura e fechamento de caixa',
      importance: Importance.high,
      playSound: true,
    );

    const AndroidNotificationChannel stockChannel = AndroidNotificationChannel(
      'stock_channel',
      'Estoque',
      description: 'Alertas de estoque baixo e reposição',
      importance: Importance.defaultImportance,
    );

    const AndroidNotificationChannel debtsChannel = AndroidNotificationChannel(
      'debts_channel',
      'Dívidas',
      description: 'Notificações de dívidas vencidas',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(salesChannel);

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(cashChannel);

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(stockChannel);

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(debtsChannel);
  }

  void _handleForegroundMessage(RemoteMessage message) {
    if (kDebugMode)
      debugPrint(
          '📨 Foreground message received: ${message.notification?.title}');

    final notification = message.notification;
    final data = message.data;

    if (notification != null) {
      _showLocalNotification(
        title: notification.title ?? 'BarManager Pro',
        body: notification.body ?? '',
        payload: data,
      );
    }

    onMessageReceived?.call(data);
  }

  void _handleBackgroundMessage(RemoteMessage message) {
    if (kDebugMode)
      debugPrint(
          '📨 Background message opened: ${message.notification?.title}');
    onMessageReceived?.call(message.data);
  }

  void _onNotificationTapped(NotificationResponse response) {
    if (kDebugMode) debugPrint('👆 Notification tapped: ${response.payload}');
    // Handle notification tap - navigate to specific screen based on payload
  }

  Future<void> _showLocalNotification({
    required String title,
    required String body,
    Map<String, dynamic>? payload,
  }) async {
    // TODO: Implementar canais dinâmicos baseados no tipo de notificação
    // Por enquanto, usa canal padrão de vendas

    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'sales_channel',
      'Vendas',
      channelDescription: 'Notificações de vendas e transações',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const NotificationDetails notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: DarwinNotificationDetails(),
    );

    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      notificationDetails,
      payload: payload?.toString(),
    );
  }

  // Public methods for local notifications
  Future<void> showSaleNotification({
    required String saleNumber,
    required double amount,
  }) async {
    await _showLocalNotification(
      title: '💰 Nova Venda Realizada',
      body: 'Venda $saleNumber - XOF ${amount.toStringAsFixed(0)}',
      payload: {'type': 'sale', 'saleNumber': saleNumber},
    );
  }

  Future<void> showCashBoxNotification({
    required String action,
    required String cashierName,
  }) async {
    final title = action == 'open' ? '🔓 Caixa Aberto' : '🔒 Caixa Fechado';
    await _showLocalNotification(
      title: title,
      body: 'Por $cashierName',
      payload: {'type': 'cash', 'action': action},
    );
  }

  Future<void> showLowStockNotification({
    required String productName,
    required int quantity,
  }) async {
    await _showLocalNotification(
      title: '⚠️ Estoque Baixo',
      body: '$productName - Apenas $quantity unidades restantes',
      payload: {'type': 'stock', 'product': productName},
    );
  }

  Future<void> showOverdueDebtNotification({
    required String customerName,
    required double amount,
  }) async {
    await _showLocalNotification(
      title: '🔔 Dívida Vencida',
      body: '$customerName - XOF ${amount.toStringAsFixed(0)}',
      payload: {'type': 'debt', 'customer': customerName},
    );
  }

  // Get FCM token
  String? get fcmToken => _fcmToken;

  // Subscribe/Unsubscribe to topics
  Future<void> subscribeToTopic(String topic) async {
    try {
      await _firebaseMessaging.subscribeToTopic(topic);
      if (kDebugMode) debugPrint('✅ Subscribed to topic: $topic');
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Error subscribing to topic: $e');
    }
  }

  Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _firebaseMessaging.unsubscribeFromTopic(topic);
      if (kDebugMode) debugPrint('✅ Unsubscribed from topic: $topic');
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Error unsubscribing from topic: $e');
    }
  }
}

// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (kDebugMode)
    debugPrint(
        '📨 Background message received: ${message.notification?.title}');
}
