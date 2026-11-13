section Section1;

shared POS_Sales_Export_2025 = let
    Source = Csv.Document(File.Contents("\\Mac\Home\Downloads\drive-download-20261012T142216Z-1-001\POS_Sales_Export_2025.csv"),[Delimiter=",", Columns=11, Encoding=1252, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"receipt_no", type text}, {"line_no", Int64.Type}, {"business_date", type date}, {"store_id", Int64.Type}, {"product_id", Int64.Type}, {"qty", Int64.Type}, {"unit_price", type number}, {"discount_amount", type number}, {"line_amount", type number}, {"currency", type text}, {"exported_at", type datetime}})
in
    #"Changed Type";