import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const BakeryProductionApp());
}

const String _apiBaseUrl = 'http://127.0.0.1:4000';
const String _productionUsername = 'production';
const String _productionPassword = 'production123';

class BakeryProductionApp extends StatelessWidget {
  const BakeryProductionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Aeden Bakes Production',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFB06B32)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF9F4EC),
      ),
      home: const ProductionHome(),
    );
  }
}

class ProductionHome extends StatefulWidget {
  const ProductionHome({super.key});

  @override
  State<ProductionHome> createState() => _ProductionHomeState();
}

class _ProductionHomeState extends State<ProductionHome> {
  String? _token;
  bool _loading = true;
  String? _error;
  _ProductionSnapshot? _snapshot;
  String? _actionMessage;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final loginResponse = await http.post(
        Uri.parse('$_apiBaseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': _productionUsername, 'password': _productionPassword}),
      );
      if (loginResponse.statusCode < 200 || loginResponse.statusCode >= 300) {
        throw Exception('Production login failed with status ${loginResponse.statusCode}');
      }

      final loginJson = jsonDecode(loginResponse.body) as Map<String, dynamic>;
      _token = loginJson['token'] as String?;
      await _refreshSnapshot();
    } catch (error) {
      _error = error.toString();
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshSnapshot() async {
    final token = _token;
    if (token == null) {
      throw Exception('Missing production session token');
    }

    final responses = await Future.wait([
      http.get(Uri.parse('$_apiBaseUrl/production/batches'), headers: _authHeaders(token)),
      http.get(Uri.parse('$_apiBaseUrl/catalog'), headers: _authHeaders(token)),
      http.get(Uri.parse('$_apiBaseUrl/orders'), headers: _authHeaders(token)),
    ]);

    for (final response in responses) {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('API returned ${response.statusCode}');
      }
    }

    final batchJson = jsonDecode(responses[0].body) as Map<String, dynamic>;
    final catalogJson = jsonDecode(responses[1].body) as Map<String, dynamic>;
    final ordersJson = jsonDecode(responses[2].body) as Map<String, dynamic>;

    _snapshot = _ProductionSnapshot.fromJson(
      batchJson,
      catalogJson: catalogJson,
      ordersJson: ordersJson,
    );

    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _changeBatchStatus(String endpoint, String successMessage) async {
    final token = _token;
    final snapshot = _snapshot;
    if (token == null || snapshot == null) {
      return;
    }

    final response = await http.post(
      Uri.parse('$_apiBaseUrl/$endpoint/${snapshot.batch.id}'),
      headers: _authHeaders(token),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(payload['error'] as String? ?? 'Batch update failed');
    }

    _actionMessage = successMessage;
    await _refreshSnapshot();
    if (mounted) {
      setState(() {});
    }
  }

  Map<String, String> _authHeaders(String token) => {'Authorization': 'Bearer $token'};

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const _LoadingScreen(message: 'Signing into production...');
    }

    if (_error != null && _snapshot == null) {
      return _ErrorState(
        message: 'Could not load the live production sheet.',
        details: _error!,
        onRetry: _bootstrap,
      );
    }

    final snapshot = _snapshot;
    if (snapshot == null) {
      return const _ErrorState(
        message: 'Production data was empty.',
        details: 'The API responded without batches or catalog data.',
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Production board'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Chip(label: Text(snapshot.batch.status.toUpperCase())),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _refreshSnapshot();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _HeroCard(
              title: 'Tomorrow\'s confirmed orders become the baker\'s sheet.',
              subtitle:
                  'The app groups items by batch and flags shortages before the team starts mixing or laminating.',
              statLabel: 'Confirmed units',
              statValue: '${snapshot.confirmedUnits}',
              statusValue: snapshot.batch.status.toUpperCase(),
            ),
            if (_actionMessage != null) ...[
              const SizedBox(height: 12),
              _ActionBanner(text: _actionMessage!),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              _ActionBanner(text: _error!, bad: true),
            ],
            const SizedBox(height: 16),
            _SectionTitle(
              title: 'Batch controls',
              subtitle: 'Draft, lock, in-progress, and complete states stay auditable.',
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton(
                  onPressed: snapshot.canLock
                      ? () => _changeBatchStatus('production/batches', 'Batch locked.')
                      : null,
                  child: const Text('Lock'),
                ),
                FilledButton(
                  onPressed: snapshot.canStart
                      ? () => _changeBatchStatus('production/batches/start', 'Batch started.')
                      : null,
                  child: const Text('Start'),
                ),
                FilledButton(
                  onPressed: snapshot.canComplete
                      ? () => _changeBatchStatus('production/batches/complete', 'Batch completed.')
                      : null,
                  child: const Text('Complete'),
                ),
                OutlinedButton(
                  onPressed: snapshot.canUnlock
                      ? () => _changeBatchStatus('production/batches/unlock', 'Batch unlocked.')
                      : null,
                  child: const Text('Unlock'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _SectionTitle(
              title: 'Batch lines',
              subtitle: 'What the production floor needs to make next.',
            ),
            const SizedBox(height: 12),
            ...snapshot.lines.map(
              (line) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _LineCard(line: line),
              ),
            ),
            const SizedBox(height: 8),
            const _AlertCard(
              title: 'Guardrail',
              body: 'No manual quantity change below booked demand without an override reason.',
            ),
            const SizedBox(height: 12),
            const _AlertCard(
              title: 'Output',
              body: 'Print-ready sheet splits totals by product and delivery slot.',
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductionSnapshot {
  const _ProductionSnapshot({
    required this.batch,
    required this.confirmedUnits,
    required this.lines,
  });

  final _ProductionBatch batch;
  final int confirmedUnits;
  final List<_ProductionLine> lines;

  bool get canLock => batch.status == 'draft';
  bool get canStart => batch.status == 'locked';
  bool get canComplete => batch.status == 'in_progress';
  bool get canUnlock => batch.status == 'locked';

  factory _ProductionSnapshot.fromJson(
    Map<String, dynamic> batchJson, {
    required Map<String, dynamic> catalogJson,
    required Map<String, dynamic> ordersJson,
  }) {
    final batchList = (batchJson['productionBatches'] as List<dynamic>? ?? const [])
        .map((entry) => _ProductionBatch.fromJson(entry as Map<String, dynamic>))
        .toList(growable: false);
    final batch = batchList.isNotEmpty ? batchList.first : const _ProductionBatch(id: 'none', status: 'draft', lines: []);

    final productById = {
      for (final entry in (catalogJson['products'] as List<dynamic>? ?? const []))
        (entry as Map<String, dynamic>)['id'] as String? ?? '': _Product.fromJson(entry as Map<String, dynamic>),
    };

    final lines = batch.lines.map((line) {
      final product = productById[line.productId];
      final plannedQuantity = line.plannedQuantity ?? line.quantity;
      final actualQuantity = line.actualQuantity ?? plannedQuantity;
      final shortage = line.shortQuantity ?? 0;
      return _ProductionLine(
        productName: product?.name ?? line.productId,
        productCategory: product?.category ?? 'Unknown',
        slotId: line.slotId,
        plannedQuantity: plannedQuantity,
        actualQuantity: actualQuantity,
        shortQuantity: shortage,
        note: line.note ?? '',
      );
    }).toList(growable: false);

    final confirmedUnits = lines.fold<int>(0, (sum, line) => sum + line.plannedQuantity);

    return _ProductionSnapshot(batch: batch, confirmedUnits: confirmedUnits, lines: lines);
  }
}

class _ProductionBatch {
  const _ProductionBatch({
    required this.id,
    required this.status,
    required this.lines,
  });

  final String id;
  final String status;
  final List<_BatchLine> lines;

  factory _ProductionBatch.fromJson(Map<String, dynamic> json) {
    return _ProductionBatch(
      id: json['id'] as String? ?? 'batch',
      status: json['status'] as String? ?? 'draft',
      lines: (json['lines'] as List<dynamic>? ?? const [])
          .map((entry) => _BatchLine.fromJson(entry as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}

class _BatchLine {
  const _BatchLine({
    required this.productId,
    required this.slotId,
    required this.quantity,
    required this.plannedQuantity,
    required this.actualQuantity,
    required this.shortQuantity,
    required this.note,
  });

  final String productId;
  final String slotId;
  final int quantity;
  final int plannedQuantity;
  final int actualQuantity;
  final int shortQuantity;
  final String note;

  factory _BatchLine.fromJson(Map<String, dynamic> json) {
    return _BatchLine(
      productId: json['productId'] as String? ?? '',
      slotId: json['slotId'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      plannedQuantity: (json['plannedQuantity'] as num?)?.toInt() ?? (json['quantity'] as num?)?.toInt() ?? 0,
      actualQuantity: (json['actualQuantity'] as num?)?.toInt() ?? (json['quantity'] as num?)?.toInt() ?? 0,
      shortQuantity: (json['shortQuantity'] as num?)?.toInt() ?? 0,
      note: json['note'] as String? ?? '',
    );
  }
}

class _Product {
  const _Product({required this.name, required this.category});

  final String name;
  final String category;

  factory _Product.fromJson(Map<String, dynamic> json) {
    return _Product(
      name: json['name'] as String? ?? 'Unknown product',
      category: json['category'] as String? ?? 'Uncategorized',
    );
  }
}

class _ProductionLine {
  const _ProductionLine({
    required this.productName,
    required this.productCategory,
    required this.slotId,
    required this.plannedQuantity,
    required this.actualQuantity,
    required this.shortQuantity,
    required this.note,
  });

  final String productName;
  final String productCategory;
  final String slotId;
  final int plannedQuantity;
  final int actualQuantity;
  final int shortQuantity;
  final String note;

  String get statusLabel {
    if (shortQuantity <= 0) {
      return 'Locked';
    }
    if (shortQuantity <= 5) {
      return 'Tight';
    }
    return 'Shortage risk';
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.title,
    required this.subtitle,
    required this.statLabel,
    required this.statValue,
    required this.statusValue,
  });

  final String title;
  final String subtitle;
  final String statLabel;
  final String statValue;
  final String statusValue;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFEBD9), Color(0xFFFFF9F2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Text(subtitle),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: _MetricPill(label: statLabel, value: statValue)),
              const SizedBox(width: 12),
              Expanded(child: _MetricPill(label: 'Status', value: statusValue)),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 4),
          Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text(subtitle),
      ],
    );
  }
}

class _LineCard extends StatelessWidget {
  const _LineCard({required this.line});

  final _ProductionLine line;

  @override
  Widget build(BuildContext context) {
    final badgeColor = switch (line.statusLabel) {
      'Locked' => Colors.green.shade100,
      'Tight' => Colors.amber.shade100,
      _ => Colors.red.shade100,
    };

    return Card(
      elevation: 0,
      color: Colors.white.withValues(alpha: 0.9),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(line.productName, style: Theme.of(context).textTheme.titleMedium),
                    Text(line.productCategory, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: badgeColor,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(line.statusLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Planned: ${line.plannedQuantity} pcs | Actual: ${line.actualQuantity} pcs | Short: ${line.shortQuantity} pcs | Slot: ${line.slotId}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (line.note.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(line.note, style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 12),
            LinearProgressIndicator(
              value: line.plannedQuantity == 0 ? 0.0 : (line.actualQuantity / line.plannedQuantity).clamp(0.0, 1.0),
              minHeight: 8,
              borderRadius: BorderRadius.circular(999),
            ),
          ],
        ),
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(body),
        ],
      ),
    );
  }
}

class _ActionBanner extends StatelessWidget {
  const _ActionBanner({required this.text, this.bad = false});

  final String text;
  final bool bad;

  @override
  Widget build(BuildContext context) {
    final background = bad ? Colors.red.shade50 : Colors.green.shade50;
    final foreground = bad ? Colors.red.shade900 : Colors.green.shade900;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(text, style: TextStyle(color: foreground)),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.details, this.onRetry});

  final String message;
  final String details;
  final Future<void> Function()? onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(details),
                const SizedBox(height: 16),
                if (onRetry != null)
                  FilledButton(
                    onPressed: () {
                      onRetry!();
                    },
                    child: const Text('Retry'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text(message)),
    );
  }
}
