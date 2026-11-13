section Section1;

shared q_WEB_Raw = let
    Source = Csv.Document(File.Contents("C:\Users\Lenovo\Downloads\WEB_Orders_Export.csv"),[Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"web_order_id", type text}, {"order_date", type date}, {"delivery_date", type date}, {"order_status", type text}, {"return_date", type date}, {"currency", type text}, {"items_qty", Int64.Type}, {"gross_amount", type number}, {"discount_amount", type number}, {"net_amount", type number}}),
    #"Changed Type with Locale" = Table.TransformColumnTypes(#"Changed Type", {{"order_date", type date}, {"delivery_date", type date}, {"return_date", type date}}, "en-US")
in
    #"Changed Type with Locale";

shared #"q_WEB_Raw (2)" = let
    Source = Csv.Document(File.Contents("C:\Users\Lenovo\Downloads\WEB_Orders_Export.csv"),[Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"web_order_id", type text}, {"order_date", type date}, {"delivery_date", type date}, {"order_status", type text}, {"return_date", type date}, {"currency", type text}, {"items_qty", Int64.Type}, {"gross_amount", type number}, {"discount_amount", type number}, {"net_amount", type number}}),
    #"Changed Type with Locale" = Table.TransformColumnTypes(#"Changed Type", {{"order_date", type date}, {"delivery_date", type date}, {"return_date", type date}}, "en-US")
in
    #"Changed Type with Locale";