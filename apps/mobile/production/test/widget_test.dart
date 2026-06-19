import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:production_app/main.dart';

void main() {
  testWidgets('renders production shell', (WidgetTester tester) async {
    await tester.pumpWidget(const BakeryProductionApp());
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
