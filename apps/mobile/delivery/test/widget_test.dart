import 'package:flutter_test/flutter_test.dart';

import 'package:delivery_app/main.dart';

void main() {
  testWidgets('shows the delivery shell', (WidgetTester tester) async {
    await tester.pumpWidget(const AedenDeliveryApp());
    await tester.pumpAndSettle();

    expect(find.text('Delivery Ops'), findsOneWidget);
  });
}
